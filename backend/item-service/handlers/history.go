package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/viettungvuong/emiumuagi-backend/database"
)

func GetHistories(c *gin.Context) {
	var res []struct {
		ID       uuid.UUID `json:"id"`
		ItemID   uint      `json:"item_id"`
		ItemName string    `json:"item_name"`
		Score    *int      `json:"score"`
		Content  *string   `json:"content"`
	}

	err := database.DB.Raw(`
		SELECT h.id, h.item_id, i.item_name, h.time, r.score, r.content
		FROM histories h
		LEFT JOIN items i ON h.item_id = i.id
		LEFT JOIN reviews r ON h.id = r.history_id
		ORDER BY h.time DESC
	`).Scan(&res).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve histories"})
		return
	}

	c.JSON(http.StatusOK, res)
}
