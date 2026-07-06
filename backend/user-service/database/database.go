package database

import (
	"log"
	"os"
	"strings"

	"github.com/viettungvuong/emiumuagi-user-service/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() {
	dsn := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dsn == "" {
		log.Fatal("DATABASE_URL is not set")
	}

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	err = DB.AutoMigrate(&models.User{}, &models.Token{})
	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	log.Println("User Service database connected and migrated successfully.")
}
