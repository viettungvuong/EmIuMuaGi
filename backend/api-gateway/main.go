package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
	"syscall"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

type service struct{ name, target string }

var (
	userService = service{"user-service", "http://localhost:8001"}
	itemService = service{"item-service", "http://localhost:8002"}
	aiService   = service{"ai-service", "http://localhost:8004"}
)

// What a failed proxy call usually means, for the log
func proxyErrorHint(err error) string {
	var netErr net.Error
	switch {
	case errors.Is(err, syscall.ECONNREFUSED):
		return "nothing is listening there: the service isn't running, or runs on another port"
	case errors.As(err, &netErr) && netErr.Timeout():
		return "it didn't answer in time: the service is stuck or overloaded"
	default:
		return "see the service's own log"
	}
}

func proxy(s service) gin.HandlerFunc {
	url, err := url.Parse(s.target)
	if err != nil {
		log.Fatal(err)
	}
	proxy := httputil.NewSingleHostReverseProxy(url)

	// The default handler only logs "http: proxy error: …"; name the service and the likely cause
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		if errors.Is(err, context.Canceled) {
			return // the client went away mid-request, not the service's fault
		}
		log.Printf("proxy: %s %s -> %s at %s failed: %v (%s)", r.Method, r.URL.Path, s.name, s.target, err, proxyErrorHint(err))
		fmt.Fprintf(w, `{"error":"%s is unavailable"}`, s.name)
	}

	return func(c *gin.Context) {
		proxy.ServeHTTP(c.Writer, c.Request)
	}
}

func main() {
	_ = godotenv.Load(".env")

	r := gin.Default()

	// CORS Configuration (API Gateway handles all CORS)
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{
		"http://localhost",
		"http://localhost:5173",
		"http://127.0.0.1:5173",
		"https://viettungvuong.github.io",
	}
	config.AllowCredentials = true
	config.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization", "ngrok-skip-browser-warning"}
	r.Use(cors.New(config))

	r.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "EmIuMuaGi API Gateway is running"})
	})

	// Redirect based on endpoints
	r.Any("/api/auth/*path", proxy(userService))
	r.Any("/api/partner/*path", proxy(userService))
	r.Any("/api/me", proxy(userService))
	r.Any("/api/items", proxy(itemService))
	r.Any("/api/items/*path", proxy(itemService))
	r.Any("/api/history", proxy(itemService))
	r.Any("/api/history/*path", proxy(itemService))
	r.Any("/api/parse/*path", proxy(aiService)) // WebSocket, ReverseProxy passes the upgrade through

	// Fallback custom matcher just in case
	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		if strings.HasPrefix(path, "/api/auth") || strings.HasPrefix(path, "/api/partner") || path == "/api/me" {
			proxy(userService)(c)
			return
		}
		if strings.HasPrefix(path, "/api/items") || strings.HasPrefix(path, "/api/history") {
			proxy(itemService)(c)
			return
		}
		if strings.HasPrefix(path, "/api/parse") {
			proxy(aiService)(c)
			return
		}
		c.JSON(http.StatusNotFound, gin.H{"error": "API route not found on gateway"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}

	log.Printf("Starting API Gateway on port %s...", port)
	r.Run("0.0.0.0:" + port)
}
