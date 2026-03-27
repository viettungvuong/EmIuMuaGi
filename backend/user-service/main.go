package main

// @title EmIuMuaGi User Service API
// @version 1.0
// @description Microservice for user management and authentication.
// @host localhost:8001
// @BasePath /api

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/viettungvuong/emiumuagi-user-service/database"
	"github.com/viettungvuong/emiumuagi-user-service/handlers"
	_ "github.com/viettungvuong/emiumuagi-user-service/docs"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

func main() {
	godotenv.Load(".env")

	database.InitDB()

	r := gin.Default()

	// Root path
	r.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "EmIuMuaGi User Service API is running"})
	})

	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// API Paths
	api := r.Group("/api")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/login", handlers.Login)
			auth.POST("/signup", handlers.SignUp)
			auth.GET("/refresh", handlers.RefreshToken)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8001"
	}

	log.Printf("Starting user server on port %s...", port)
	r.Run("0.0.0.0:" + port)
}
