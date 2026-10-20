package internal

import (
	"errors"
	"fmt"
	"log"
	"net"
	"os"
	"strconv"
	"syscall"
	"time"
)

// How many ports past the first one to try before giving up
const maxPortTries = 20

// PreferredPort is PORT from the env, else fallback. The -port flag, which the
// API gateway passes, overrides both.
func PreferredPort(fallback int) int {
	if p, err := strconv.Atoi(os.Getenv("PORT")); err == nil && p > 0 {
		return p
	}
	return fallback
}

// ListenFrom opens the first free port from start upwards: when something else
// already holds a port (another app, a Docker container), it moves on by one.
// A port counts as held if something answers on it, not only if binding fails:
// macOS lets 0.0.0.0 and 127.0.0.1 share a port, and the gateway's requests to
// 127.0.0.1 would then reach the other program.
// Once listening it prints "SERVICE_PORT=<port>", which the API gateway reads to
// know where to send this service's requests.
func ListenFrom(start int) (net.Listener, error) {
	for port := start; port < start+maxPortTries; port++ {
		if answers(port) {
			log.Printf("Port %d is taken, trying %d", port, port+1)
			continue
		}
		ln, err := net.Listen("tcp", fmt.Sprintf("0.0.0.0:%d", port))
		if err == nil {
			fmt.Printf("SERVICE_PORT=%d\n", port)
			return ln, nil
		}
		if !errors.Is(err, syscall.EADDRINUSE) {
			return nil, err
		}
		log.Printf("Port %d is taken, trying %d", port, port+1)
	}
	return nil, fmt.Errorf("no free port between %d and %d", start, start+maxPortTries-1)
}

// answers reports whether something is already listening on the port here
func answers(port int) bool {
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", port), 300*time.Millisecond)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}
