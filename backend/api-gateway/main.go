package main

import (
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func proxy(target string) gin.HandlerFunc {
	url, err := url.Parse(target)
	if err != nil {
		log.Fatal(err)
	}
	proxy := httputil.NewSingleHostReverseProxy(url)

	return func(c *gin.Context) {
		proxy.ServeHTTP(c.Writer, c.Request)
	}
}

func main() {
	_ = godotenv.Load("../.env")

	r := gin.Default()

	// CORS Configuration (API Gateway handles all CORS)
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{
		"http://localhost:5173",
		"http://127.0.0.1:5173",
		"https://viettungvuong.github.io",
	}
	config.AllowCredentials = true
	config.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"*"}
	r.Use(cors.New(config))

	r.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "EmIuMuaGi API Gateway is running"})
	})

	// Setup Reverse Proxies
	// Note: We use c.Request.URL.Path to determine routing, or we can use Group

	r.Any("/api/auth/*path", proxy("http://localhost:8001"))
	r.Any("/api/items", proxy("http://localhost:8002"))
	r.Any("/api/items/*path", proxy("http://localhost:8002"))

	// Fallback custom matcher just in case
	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		if strings.HasPrefix(path, "/api/auth") {
			proxy("http://localhost:8001")(c)
			return
		}
		if strings.HasPrefix(path, "/api/items") {
			proxy("http://localhost:8002")(c)
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
