package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/viettungvuong/emiumuagi-backend/database"
	"github.com/viettungvuong/emiumuagi-backend/models"
)

// AddReview rates one purchase (a history entry). Ratings belong to history,
// not to items: an item bought twice has two purchases to rate.
func AddReview(c *gin.Context) {
	historyId := c.Param("history_id")

	hUUID, err := uuid.Parse(historyId)
	// try parse to uuid
	if err != nil {
		log.Printf("[review] %q: invalid history id", historyId)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid history ID format"})
		return
	}

	// try find History object based on param
	var history models.History
	if err := database.DB.First(&history, hUUID).Error; err != nil {
		log.Printf("[review] %s: purchase not found (%v)", hUUID, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "History record not found"})
		return
	}

	// Only the couple the item belongs to can review it
	if _, ok := loadItemInScope(c, history.ItemID); !ok {
		return
	}

	var reqBody struct {
		Score   int    `json:"score" binding:"required"`
		Content string `json:"content"`
	}

	if err := c.ShouldBindJSON(&reqBody); err != nil {
		log.Printf("[review] %s: invalid request: %v", hUUID, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// A purchase is rated once; a second rating would list it twice in history
	var existing int64
	if err := database.DB.Model(&models.Review{}).Where("history_id = ?", hUUID).Count(&existing).Error; err != nil {
		log.Printf("[review] %s: could not check for an earlier rating: %v", hUUID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if existing > 0 {
		log.Printf("[review] %s: already rated", hUUID)
		c.JSON(http.StatusConflict, gin.H{"error": "This purchase has already been rated"})
		return
	}

	// Create Review
	review := models.Review{
		HistoryID: hUUID,
		Score:     reqBody.Score,
		Content:   reqBody.Content,
	}

	if err := database.DB.Create(&review).Error; err != nil {
		log.Printf("[review] %s: could not save: %v", hUUID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	log.Printf("[review] %s (item #%d) rated %d by %s", hUUID, history.ItemID, review.Score, c.GetString("username"))

	c.JSON(http.StatusCreated, review)
}
