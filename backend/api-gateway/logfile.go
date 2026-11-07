package main

import (
	"io"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// How long hourly log files are kept, unless LOG_RETENTION_DAYS says otherwise
const defaultLogRetentionDays = 14

// hourlyLog writes to <dir>/<YYYY-MM-DD_HH>.log, starting a new file when the
// hour changes and deleting the ones older than retention as it does
type hourlyLog struct {
	dir       string
	retention time.Duration

	mu   sync.Mutex
	hour string
	file *os.File
}

func (h *hourlyLog) Write(p []byte) (int, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if hour := time.Now().Format("2006-01-02_15"); hour != h.hour {
		file, err := os.OpenFile(filepath.Join(h.dir, hour+".log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
		if err != nil {
			return 0, err // the console still gets the line; the next write tries again
		}
		if h.file != nil {
			h.file.Close()
		}
		h.file, h.hour = file, hour
		h.prune()
	}
	return h.file.Write(p)
}

// prune deletes log files last written before the retention window
func (h *hourlyLog) prune() {
	old, _ := filepath.Glob(filepath.Join(h.dir, "*.log"))
	cutoff := time.Now().Add(-h.retention)
	for _, path := range old {
		if info, err := os.Stat(path); err == nil && info.ModTime().Before(cutoff) {
			os.Remove(path)
		}
	}
}

// setupLogging sends the gateway's log, and with it every service's output
// (see readOutput), to the console and to an hourly file under LOG_DIR
// (default ./logs). Must run before gin.Default so its request log goes there too.
func setupLogging() {
	dir := os.Getenv("LOG_DIR")
	if dir == "" {
		dir = "logs"
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		log.Printf("Logging to the console only, could not create %s: %v", dir, err)
		return
	}

	days, err := strconv.Atoi(os.Getenv("LOG_RETENTION_DAYS"))
	if err != nil || days <= 0 {
		days = defaultLogRetentionDays
	}

	// Console first: io.MultiWriter stops at the first writer that fails
	out := io.MultiWriter(os.Stderr, &hourlyLog{dir: dir, retention: time.Duration(days) * 24 * time.Hour})
	log.SetOutput(out)
	gin.DefaultWriter = out
	gin.DefaultErrorWriter = out

	abs, _ := filepath.Abs(dir)
	log.Printf("Logging to %s, one file per hour, kept %d days", abs, days)
}
