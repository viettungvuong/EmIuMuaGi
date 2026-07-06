package main

// @title EmIuMuaGi Item Service API
// @version 1.0
// @description Microservice for item and history management.
// @host localhost:8002
// @BasePath /api

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization

import (
	"log"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"github.com/viettungvuong/emiumuagi-backend/database"
	_ "github.com/viettungvuong/emiumuagi-backend/docs"
	"github.com/viettungvuong/emiumuagi-backend/handlers"
	"github.com/viettungvuong/emiumuagi-backend/internal"
)

func loadEnv() {
	_ = godotenv.Load(".env")

	executable, err := os.Executable()
	if err != nil {
		log.Printf("Could not locate executable while loading .env: %v", err)
		return
	}

	executableEnv := filepath.Join(filepath.Dir(executable), ".env")
	if err := godotenv.Load(executableEnv); err != nil && os.Getenv("DATABASE_URL") == "" {
		log.Printf("Could not load .env from %s: %v", executableEnv, err)
	}
}

func main() {
	loadEnv()

	database.InitDB()

	r := gin.Default()

	// Root path
	r.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "EmIuMuaGi API is running"})
	})

	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	api := r.Group("/api")
	api.Use(internal.AuthMiddleware())
	{
		items := api.Group("/items")
		{
			items.GET("", handlers.GetItems)
			items.POST("", handlers.CreateItem)
			items.DELETE("/:item_id", handlers.DeleteItem)
			items.PATCH("/:item_id/bought", handlers.MarkItemAsBought)
			items.POST("/:item_id/review", handlers.AddReview)
			items.POST("/:item_id/files", handlers.UploadItemFiles)
			items.GET("/:item_id/tasks/:task_id", handlers.TaskStatus)
		}

		history := api.Group("/history")
		{
			history.GET("", handlers.GetHistories)
			history.POST("/:history_id/review", handlers.AddReview)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8002"
	}

	log.Printf("Starting item server on port %s...", port)
	r.Run("0.0.0.0:" + port)
}
