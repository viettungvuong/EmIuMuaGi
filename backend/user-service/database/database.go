package database

import (
	"fmt"
	"log"
	"os"
	"regexp"
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

	dbName := "emiumuagi_user"

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

	// Older rows can hold half-finished links from before linking became
	// transactional. Clear them first, otherwise the unique index on partner_id
	// cannot be built.
	if DB.Migrator().HasTable(&models.User{}) && DB.Migrator().HasColumn(&models.User{}, "PartnerID") {
		if err := clearBrokenPartnerLinks(DB); err != nil {
			log.Fatal("Failed to clean up partner links:", err)
		}
	}

	err = DB.AutoMigrate(&models.User{}, &models.Token{})
	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	log.Println("User Service database connected and migrated successfully.")
}

// clearBrokenPartnerLinks unsets every partner_id that is not half of a mutual
// pair, self-links included, so at most one user points at any given partner.
func clearBrokenPartnerLinks(db *gorm.DB) error {
	res := db.Exec(`
		UPDATE users AS u
		SET partner_id = NULL
		WHERE u.partner_id IS NOT NULL
		  AND (
		    u.partner_id = u.id
		    OR NOT EXISTS (
		      SELECT 1 FROM users AS p
		      WHERE p.id = u.partner_id AND p.partner_id = u.id
		    )
		  )
	`)
	if res.Error != nil {
		return res.Error
	}

	if res.RowsAffected > 0 {
		log.Printf("Cleared %d one-sided partner link(s)", res.RowsAffected)
	}

	return nil
}
