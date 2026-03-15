package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/viettungvuong/emiumuagi-backend/database"
)

func GetHistories(c *gin.Context) {
	type HistoryResult struct {
		ID       uuid.UUID `json:"id" gorm:"column:id"`
		ItemID   uint      `json:"item_id" gorm:"column:item_id"`
		ItemName string    `json:"item_name" gorm:"column:item_name"`
		Time     time.Time `json:"time" gorm:"column:time"`
		Score    *int      `json:"score" gorm:"column:score"`
		Content  *string   `json:"content" gorm:"column:content"`
	}

	res := []HistoryResult{}

	err := database.DB.Raw(`
		SELECT h.id, h.item_id, i.item_name, h.time, r.score, r.content
		FROM histories h
		LEFT JOIN items i ON h.item_id = i.id
		LEFT JOIN reviews r ON h.id = r.history_id
		ORDER BY h.time DESC
	`).Scan(&res).Error

	if err != nil {
		fmt.Printf("Error fetching histories: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve histories"})
		return
	}

	fmt.Printf("Fetched %d history records\n", len(res))
	c.JSON(http.StatusOK, res)
}
