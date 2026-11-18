package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/viettungvuong/emiumuagi-backend/database"
	"github.com/viettungvuong/emiumuagi-backend/internal"
	"github.com/viettungvuong/emiumuagi-backend/models"
)

// DeleteAccountData removes everything the caller has here, for the user service
// while it deletes their account: every item they added (with its purchases,
// ratings, dates and uploads, binned ones too) and the dates they booked at their
// partner's restaurants. The partner's own items stay. Not routed by the gateway.
func DeleteAccountData(c *gin.Context) {
	username := c.GetString("username")

	var items []models.Item
	if err := database.DB.Where("owner = ?", username).Find(&items).Error; err != nil {
		log.Printf("[account] delete data of %s: could not list items: %v", username, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not delete your items"})
		return
	}

	for _, item := range items {
		if err := internal.PurgeItem(item); err != nil {
			log.Printf("[account] delete data of %s: item #%d %q: %v", username, item.ID, item.ItemName, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not delete your items"})
			return
		}
	}

	res := database.DB.Where("username = ?", username).Delete(&models.Schedule{})
	if res.Error != nil {
		log.Printf("[account] delete data of %s: could not delete their dates: %v", username, res.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not delete your items"})
		return
	}

	log.Printf("[account] deleted data of %s: %d item(s), %d date(s) at their partner's places", username, len(items), res.RowsAffected)
	c.JSON(http.StatusOK, gin.H{"items": len(items)})
}
