package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/viettungvuong/emiumuagi-backend/database"
	"github.com/viettungvuong/emiumuagi-backend/models"
)

func AddReview(c *gin.Context) {
	historyId := c.Param("history_id")

	hUUID, err := uuid.Parse(historyId)
	// try parse to uuid
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid history ID format"})
		return
	}

	// try find History object based on param
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
