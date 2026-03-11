package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/viettungvuong/emiumuagi-backend/database"
)

func viewHistories(c *gin.Context) {
	var res []struct {
		ID     uuid.UUID `json:"id"`
		ItemID uint      `json:"item_id"`
		Time   time.Time `json:"time"`
	}

	err := database.DB.Raw(`
	SELECT * FROM histories h
	`).Scan(&res).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve histories"})
		return
	}
}
