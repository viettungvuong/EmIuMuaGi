package main

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

// A backend service the gateway starts, keeps running and sends requests to
type service struct {
	name          string
	preferredPort int // passed as -port; the service moves up from it if it's taken
	command       func(dir string, port int) *exec.Cmd
}

var (
	userService = &service{"user-service", 8001, goService("user-service")}
	itemService = &service{"item-service", 8002, goService("item-service")}
	aiService   = &service{"ai-service", 8004, pythonService}

	services = []*service{userService, itemService, aiService}
)

// Where each service really listens, as it reported it: name -> port.
// 0 or missing means it isn't up (yet).
var (
	portsMu sync.RWMutex
	ports   = map[string]int{}
)

func servicePort(name string) int {
	portsMu.RLock()
	defer portsMu.RUnlock()
	return ports[name]
}

func setServicePort(name string, port int) {
	portsMu.Lock()
	defer portsMu.Unlock()
	ports[name] = port
}

func servicePorts() map[string]int {
	portsMu.RLock()
	defer portsMu.RUnlock()
	snapshot := make(map[string]int, len(services))
	for _, s := range services {
		snapshot[s.name] = ports[s.name]
	}
	return snapshot
}

// Each service lives in a folder next to the gateway's: backend/<name> in the
// repo, services/<name> on the VPS. SERVICES_DIR can point elsewhere.
func serviceDir(name string) string {
	base := os.Getenv("SERVICES_DIR")
	if base == "" {
		base = ".."
	}
	return filepath.Join(base, name)
}

// A Go service: from source with `go run` in the repo (where go.mod is), else
// the compiled binary named after it, which is what the deploy uploads
func goService(name string) func(dir string, port int) *exec.Cmd {
	return func(dir string, port int) *exec.Cmd {
		portArg := "-port=" + strconv.Itoa(port)
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return exec.Command("go", "run", ".", portArg)
		}
		return exec.Command("./"+name, portArg)
	}
}

// The ai-service runs from the .venv that its install.sh sets up
func pythonService(dir string, port int) *exec.Cmd {
	return exec.Command(filepath.Join(".venv", "bin", "python"), "main.py", "--port", strconv.Itoa(port))
}

// supervise keeps s running until ctx ends, restarting it when it stops
// (what pm2 did per service before the gateway started them)
func (s *service) supervise(ctx context.Context) {
	backoff := time.Second
	for {
		started := time.Now()
		err := s.runOnce(ctx)
		setServicePort(s.name, 0)
		if ctx.Err() != nil {
			return
		}

		// One that ran a good while gets restarted quickly again
		if time.Since(started) > time.Minute {
			backoff = time.Second
		}
		log.Printf("%s stopped (%v), restarting in %s", s.name, err, backoff)
		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}
		backoff = min(backoff*2, 30*time.Second)
	}
}

// runOnce starts the service and waits for it to exit
func (s *service) runOnce(ctx context.Context) error {
	dir := serviceDir(s.name)
	cmd := s.command(dir, s.preferredPort)
	cmd.Dir = dir // it reads its own .env from there
	cmd.SysProcAttr = childProcAttr()

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}

	log.Printf("Starting %s in %s (port %d, or the next free one)", s.name, dir, s.preferredPort)
	if err := cmd.Start(); err != nil {
		return err
	}

	// Stopping the gateway stops the service, and anything `go run` started for it
	stopped := make(chan struct{})
	defer close(stopped)
	go func() {
		select {
		case <-ctx.Done():
			stopGroup(cmd.Process.Pid)
		case <-stopped:
		}
	}()

	var output sync.WaitGroup
	output.Add(2)
	go func() {
		defer output.Done()
		s.readOutput(stdout, true)
	}()
	go func() {
		defer output.Done()
		s.readOutput(stderr, false)
	}()
	output.Wait() // the pipes must be drained before Wait
	return cmd.Wait()
}

// readOutput passes the service's log on, prefixed with its name, and records
// the port when it reports "SERVICE_PORT=<port>"
func (s *service) readOutput(r io.Reader, isStdout bool) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		if isStdout {
			if value, ok := strings.CutPrefix(line, "SERVICE_PORT="); ok {
				if port, err := strconv.Atoi(strings.TrimSpace(value)); err == nil {
					setServicePort(s.name, port)
					log.Printf("✅ %s started on port %d", s.name, port)
					logIfAllStarted()
					continue
				}
			}
		}
		log.Printf("[%s] %s", s.name, line)
	}
}

// logIfAllStarted prints one summary line once every service has a port, e.g.
// "✅ All services started: user-service :8001, item-service :8002, ai-service :8004"
// (again after a restart brings the last missing one back)
func logIfAllStarted() {
	current := servicePorts()
	parts := make([]string, 0, len(services))
	for _, s := range services {
		if current[s.name] == 0 {
			return
		}
		parts = append(parts, fmt.Sprintf("%s :%d", s.name, current[s.name]))
	}
	log.Printf("✅ All services started: %s", strings.Join(parts, ", "))
}

// stopGroup asks the service's whole process group to stop, then forces it
func stopGroup(pid int) {
	_ = syscall.Kill(-pid, syscall.SIGTERM)
	time.AfterFunc(5*time.Second, func() {
		_ = syscall.Kill(-pid, syscall.SIGKILL)
	})
}
