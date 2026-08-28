package internal

import (
	"log"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/viettungvuong/emiumuagi-backend/database"
	"github.com/viettungvuong/emiumuagi-backend/models"
	"gorm.io/gorm"
)

const (
	defaultPurgeHour = 3  // 3am, when nobody is shopping
	defaultRetention = 30 // days an item sits in the bin before it is really gone
	purgeTimeZone    = "Asia/Ho_Chi_Minh"
	purgeUploadsDir  = "./uploads"
)

// StartPurgeJob sweeps once now, in case the service was down at the scheduled
// hour, then keeps sweeping every morning.
func StartPurgeJob() {
	go func() {
		if err := PurgeDeletedItems(); err != nil {
			log.Printf("[purge] sweep failed: %v", err)
		}

		for {
			next := nextPurgeRun(time.Now())
			log.Printf("[purge] next sweep at %s", next.Format(time.RFC1123))
			time.Sleep(time.Until(next))

			if err := PurgeDeletedItems(); err != nil {
				log.Printf("[purge] sweep failed: %v", err)
			}
		}
	}()
}

func PurgeDeletedItems() error {
	cutoff := time.Now().Add(-retentionWindow())

	var items []models.Item
	if err := database.DB.
		Where("deleted_at IS NOT NULL AND deleted_at < ?", cutoff).
		Find(&items).Error; err != nil {
		return err
	}

	if len(items) == 0 {
		return nil
	}

	purged := 0
	for _, item := range items {
		if err := purgeItem(item); err != nil {
			log.Printf("[purge] item %d (%s): %v", item.ID, item.ItemName, err)
			continue
		}
		purged++
	}

	log.Printf("[purge] removed %d of %d item(s) deleted before %s",
		purged, len(items), cutoff.Format(time.DateOnly))
	return nil
}

func purgeItem(item models.Item) error {
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		// Delete in Review
		if err := tx.Exec(`
			DELETE FROM reviews
			WHERE history_id IN (SELECT id FROM histories WHERE item_id = ?)
		`, item.ID).Error; err != nil {
			return err
		}

		// Delete in History
		if err := tx.Where("item_id = ?", item.ID).Delete(&models.History{}).Error; err != nil {
			return err
		}

		// Delete in Items schema
		switch item.ItemType {
		case "clothes":
			if err := tx.Where("id = ?", item.ID).Delete(&models.Clothes{}).Error; err != nil {
				return err
			}
		case "food_and_drink":
			if err := tx.Where("id = ?", item.ID).Delete(&models.FoodAndDrink{}).Error; err != nil {
				return err
			}
		case "others":
			if err := tx.Where("id = ?", item.ID).Delete(&models.Others{}).Error; err != nil {
				return err
			}
		}

		return tx.Where("id = ?", item.ID).Delete(&models.Item{}).Error
	})
	if err != nil {
		return err
	}

	// Only once the row is gone for certain, drop whatever was uploaded for it
	dir := filepath.Join(purgeUploadsDir, strconv.FormatUint(uint64(item.ID), 10))
	if err := os.RemoveAll(dir); err != nil {
		log.Printf("[purge] item %d: could not remove %s: %v", item.ID, dir, err)
	}

	return nil
}

// nextPurgeRun is the next time the configured hour comes round in Vietnam time
func nextPurgeRun(now time.Time) time.Time {
	loc, err := time.LoadLocation(purgeTimeZone)
	if err != nil {
		loc = time.UTC
	}

	now = now.In(loc)
	next := time.Date(now.Year(), now.Month(), now.Day(), purgeHour(), 0, 0, 0, loc)
	if !next.After(now) {
		next = next.AddDate(0, 0, 1)
	}

	return next
}

func purgeHour() int {
	if h, err := strconv.Atoi(os.Getenv("PURGE_HOUR")); err == nil && h >= 0 && h <= 23 {
		return h
	}
	return defaultPurgeHour
}

func retentionWindow() time.Duration {
	days := defaultRetention
	if d, err := strconv.Atoi(os.Getenv("PURGE_AFTER_DAYS")); err == nil && d > 0 {
		days = d
	}
	return time.Duration(days) * 24 * time.Hour
}
