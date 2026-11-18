package database

import (
	"fmt"
	"log"
	"os"
	"regexp"
	"strings"
	"time"

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

	// Items from before wanted_by existed were all hers, so they take 0 (girl)
	if err := DB.Exec(`ALTER TABLE IF EXISTS items
		ADD COLUMN IF NOT EXISTS wanted_by SMALLINT NOT NULL DEFAULT 0 CHECK (wanted_by IN (0, 1))`).Error; err != nil {
		log.Fatal("Failed to add items.wanted_by:", err)
	}

	if err := addNotifyStage(DB); err != nil {
		log.Fatal("Failed to add items.notify_stage:", err)
	}

	err = DB.AutoMigrate(
		&models.Item{},
		&models.Clothes{},
		&models.FoodAndDrink{},
		&models.Others{},
		&models.Restaurant{},
		&models.History{},
		&models.Review{},
		&models.Schedule{},
		&models.PushToken{},
	)
	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}
	// -----------------------

	log.Println("Database connected and migrated successfully.")
}

// addNotifyStage adds items.notify_stage to a list that already has items, as if
// the notification digest had always run: each item is put past the news it
// would have had by now, so the first digest doesn't bring up everything ever
// added, only the reminders still ahead of recent items. (migrations/003)
func addNotifyStage(db *gorm.DB) error {
	if !db.Migrator().HasTable(&models.Item{}) || db.Migrator().HasColumn(&models.Item{}, "NotifyStage") {
		return nil
	}

	now := time.Now()
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`ALTER TABLE items ADD COLUMN notify_stage SMALLINT NOT NULL DEFAULT 0`).Error; err != nil {
			return err
		}
		return tx.Exec(`UPDATE items SET notify_stage = CASE
				WHEN created_at > ? THEN ?
				WHEN created_at > ? THEN ?
				ELSE ? END`,
			now.AddDate(0, 0, -3), models.NotifyAnnounced,
			now.AddDate(0, 0, -7), models.NotifyRemindedDays,
			models.NotifyDone,
		).Error
	})
}
