package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/viettungvuong/emiumuagi-backend/database"
	"github.com/viettungvuong/emiumuagi-backend/models"
)

func AddReview(c *gin.Context) {
	id := c.Param("item_id")

	var item models.Item

	if err := database.DB.First(&item, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Item not found"})
		return
	}

	var reqBody struct {
		Score     int        `json:"score" binding:"required"`
		Content   string     `json:"content"`
		HistoryID *uuid.UUID `json:"historyId"` // use pointer to allow nil
	}

	if err := c.ShouldBindJSON(&reqBody); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var history models.History
	// Find the latest History for this item (if historyID not provided)
	if reqBody.HistoryID != nil {
		if err := database.DB.First(&history, *reqBody.HistoryID).Error; err != nil { // find in History schema
			c.JSON(http.StatusNotFound, gin.H{"error": "Specific history record not found"})
			return
		}
	} else {
		if err := database.DB.Where("item_id = ?", item.ID).Order("time desc").First(&history).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "No history found for this item, cannot add review"})
			return
		}
	}

	// Create Review
	review := models.Review{
		HistoryID: history.ID,
		Score:     reqBody.Score,
		Content:   reqBody.Content,
	}

	if err := database.DB.Create(&review).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create review"})
		return
	}

	c.JSON(http.StatusCreated, review)
}

func AddReviewHistory(c *gin.Context) {
	historyId := c.Param("history_id")

	hUUID, err := uuid.Parse(historyId)
	// try parse to uuid
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid history ID format"})
		return
	}

	// try find History object
	var history models.History
	if err := database.DB.First(&history, hUUID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "History record not found"})
		return
	}

	var reqBody struct {
		Score   int    `json:"score" binding:"required"`
		Content string `json:"content"`
	}

	if err := c.ShouldBindJSON(&reqBody); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Create Review
	review := models.Review{
		HistoryID: hUUID,
		Score:     reqBody.Score,
		Content:   reqBody.Content,
	}

	if err := database.DB.Create(&review).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create review"})
		return
	}

	c.JSON(http.StatusCreated, review)
}
