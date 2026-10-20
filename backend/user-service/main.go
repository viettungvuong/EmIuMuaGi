package main

// @title EmIuMuaGi User Service API
// @version 1.0
// @description Microservice for user management and authentication.
// @host localhost:8001
// @BasePath /api

import (
	"flag"
	"log"
	"net"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"github.com/viettungvuong/emiumuagi-user-service/database"
	_ "github.com/viettungvuong/emiumuagi-user-service/docs"
	"github.com/viettungvuong/emiumuagi-user-service/handlers"
	"github.com/viettungvuong/emiumuagi-user-service/internal"
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

	port := flag.Int("port", internal.PreferredPort(8001), "port to try first; the next free one is used if it's taken")
	flag.Parse()

	database.InitDB()
	database.InitRedis()

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
			auth.POST("/signup/verify", handlers.VerifySignUp) // create the user once the emailed OTP checks out
			auth.GET("/refresh", handlers.RefreshToken)        // get Refresh Token directly from the token
			auth.POST("/logout", handlers.SignOut)             // clear tokens and session
		}

		partner := api.Group("/partner")
		partner.Use(internal.AuthMiddleware())
		{
			partner.POST("/add/:inviteID", handlers.AddPartner)
			partner.DELETE("", handlers.RemovePartner)
		}

		user := api.Group("/")
		user.Use(internal.AuthMiddleware())
		{
			user.GET("/me", handlers.GetMe)
		}
	}

	// The API gateway starts this service with -port; when that port is taken the
	// next free one is used, and the gateway is told which (see internal/listen.go)
	ln, err := internal.ListenFrom(*port)
	if err != nil {
		log.Fatalf("Could not open a port: %v", err)
	}

	log.Printf("Starting user server on port %d...", ln.Addr().(*net.TCPAddr).Port)
	if err := r.RunListener(ln); err != nil {
		log.Fatal(err)
	}
}
