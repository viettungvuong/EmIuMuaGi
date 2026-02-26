package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/viettungvuong/emiumuagi-user-service/handlers"
)

func main() {
	_ = godotenv.Load("../.env")

	r := gin.Default()

	// Root path
	r.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "EmIuMuaGi User Service API is running"})
	})

	// API Paths
	api := r.Group("/api")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/login", handlers.Login)
		}
	}

	// Figure out the port and start the server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8001" // Note: Different default port than item-service
	}

	log.Printf("Starting user server on port %s...", port)
	r.Run("0.0.0.0:" + port)
}
