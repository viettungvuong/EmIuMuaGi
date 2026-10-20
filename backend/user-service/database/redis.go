package database

import (
	"context"
	"log"
	"os"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

var RDB *redis.Client

// InitRedis connects to REDIS_URL, or to a Redis on this machine when it is unset.
// An unreachable Redis is only logged: OTPs fail until it is up, but login and
// everything else keep working.
func InitRedis() {
	url := strings.TrimSpace(os.Getenv("REDIS_URL"))
	if url == "" {
		url = "redis://localhost:6379/0"
	}

	opts, err := redis.ParseURL(url)
	if err != nil {
		log.Fatalf("Invalid REDIS_URL: %v", err)
	}
	RDB = redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := RDB.Ping(ctx).Err(); err != nil {
		log.Printf("Redis at %s is not reachable, OTPs will fail until it is: %v", opts.Addr, err)
		return
	}

	log.Println("User Service Redis connected successfully.")
}
