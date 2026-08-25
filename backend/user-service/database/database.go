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
