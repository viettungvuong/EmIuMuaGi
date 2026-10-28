package database

import (
	"fmt"
	"log"
	"os"
	"regexp"
	"strings"

	"github.com/viettungvuong/emiumuagi-backend/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() {
	dsn := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dsn == "" {
		log.Fatal("DATABASE_URL is not set")
	}

	// 1. Connect to the default 'postgres' database to check/create the target database
	defaultDSN := regexp.MustCompile(`dbname=[^\s]+`).ReplaceAllString(dsn, "dbname=postgres")
	tempDB, err := gorm.Open(postgres.Open(defaultDSN), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to postgres server:", err)
	}

	// Ensure the underlying sql.DB gets closed when done
	if sqlDB, err := tempDB.DB(); err == nil {
		defer sqlDB.Close()
	}

	dbName := "emiumuagi_item"

	// 2. Check if the database already exists
	var count int64
	tempDB.Raw("SELECT count(*) FROM pg_database WHERE datname = ?", dbName).Scan(&count)

	if count == 0 {
		// PostgreSQL does not support IF NOT EXISTS, so we create it explicitly here
		// Note: Database names cannot be parameterized with '?', so fmt.Sprintf is required for identifiers.
		err = tempDB.Exec(fmt.Sprintf("CREATE DATABASE %s;", dbName)).Error
		if err != nil {
			log.Fatalf("Failed to create database %s: %v", dbName, err)
		}
	}

	// 3. Re-connect to the actual target database
	targetDSN := regexp.MustCompile(`dbname=[^\s]+`).ReplaceAllString(dsn, "dbname="+dbName)
	DB, err = gorm.Open(postgres.Open(targetDSN), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database %s: %v", dbName, err)
	}


	err = DB.AutoMigrate(
		&models.Item{},
		&models.Clothes{},
		&models.FoodAndDrink{},
		&models.Others{},
		&models.Restaurant{},
		&models.History{},
		&models.Review{},
	)
	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}
	// -----------------------

	log.Println("Database connected and migrated successfully.")
}
