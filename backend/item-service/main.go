package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/viettungvuong/emiumuagi-backend/database"
	"github.com/viettungvuong/emiumuagi-backend/handlers"
)

func main() {
	_ = godotenv.Load("../.env")

	database.InitDB()

	r := gin.Default()

	// Root path
	r.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "EmIuMuaGi API is running"})
	})

	api := r.Group("/api")
	{
		items := api.Group("/items")
		{
			items.GET("", handlers.GetItems)
			items.GET("/history", handlers.GetHistories)
			items.POST("", handlers.CreateItem)
			items.DELETE("/:item_id", handlers.DeleteItem)
			items.PATCH("/:item_id/bought", handlers.MarkItemAsBought)
			items.POST("/:item_id/review", handlers.AddReview)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8002"
	}

	log.Printf("Starting item server on port %s...", port)
	r.Run("0.0.0.0:" + port)
}
