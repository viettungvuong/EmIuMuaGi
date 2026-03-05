package database

import (
	"log"
	"os"

	"github.com/viettungvuong/emiumuagi-backend/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() {
	dbUrl := os.Getenv("DATABASE_URL")
	if dbUrl == "" {
		dbUrl = "./app.db"
	}

	var err error
	DB, err = gorm.Open(sqlite.Open(dbUrl), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// --- ADD THIS BLOCK ---
	err = DB.AutoMigrate(
		&models.Item{},
		&models.Clothes{},
		&models.FoodAndDrink{},
		&models.Others{},
		&models.History{},
		&models.Review{},
	)
	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}
	// -----------------------

	log.Println("Database connected and migrated successfully.")
}
