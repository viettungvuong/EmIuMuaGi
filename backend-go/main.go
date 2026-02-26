package main

import (
	"log"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/viettungvuong/emiumuagi-backend/database"
	"github.com/viettungvuong/emiumuagi-backend/handlers"
)

func main() {
	_ = godotenv.Load(".env")

	// Initialize the database connection & schemas
	database.InitDB()

	r := gin.Default()

	// CORS Configuration
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{
		"http://127.0.0.1:5173",
		"https://viettungvuong.github.io",
	}
	config.AllowCredentials = true
	config.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"*"}
	r.Use(cors.New(config))

	// Root path
	r.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "EmIuMuaGi API is running"})
	})

	// API Paths
	api := r.Group("/api")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/login", handlers.Login)
		}

		items := api.Group("/items")
		{
			items.GET("", handlers.GetItems)
			items.POST("", handlers.CreateItem)
			items.DELETE("/:item_id", handlers.DeleteItem)
			items.PATCH("/:item_id/buy", handlers.BuyItem)
		}
	}

	// Figure out the port and start the server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}

	log.Printf("Starting server on port %s...", port)
	r.Run("0.0.0.0:" + port)
}
