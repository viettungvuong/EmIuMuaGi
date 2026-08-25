package handlers

import (
	"log"
	"net/http"
	"slices"

	"github.com/gin-gonic/gin"
	"github.com/viettungvuong/emiumuagi-backend/database"
	"github.com/viettungvuong/emiumuagi-backend/internal"
	"github.com/viettungvuong/emiumuagi-backend/models"
)

// loadItemInScope fetches an item and confirms it sits on the caller's list or
// their partner's. It writes the failure response itself, so callers only have to
// check ok.
func loadItemInScope(c *gin.Context, itemID any) (models.Item, bool) {
	var item models.Item
	if err := database.DB.Where("id = ?", itemID).First(&item).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Item not found"})
		return item, false
	}

	owners, err := internal.OwnerScope(c)
	if err != nil {
		log.Printf("Could not resolve partner while checking item %v: %v", itemID, err)
	}

	if !slices.Contains(owners, item.Owner) {
		c.JSON(http.StatusForbidden, gin.H{"error": "This item is not on your list"})
		return item, false
	}

	return item, true
}
