package database

import (
	"log"
	"os"

	"github.com/viettungvuong/emiumuagi-backend/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		// Default to local postgres if no environment variable is set
		dsn = "host=localhost user=postgres password=postgres dbname=emiumuagi port=5432 sslmode=disable TimeZone=Asia/Ho_Chi_Minh"
	}

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
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
