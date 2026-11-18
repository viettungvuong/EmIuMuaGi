package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/viettungvuong/emiumuagi-backend/database"
	"github.com/viettungvuong/emiumuagi-backend/internal"
	"github.com/viettungvuong/emiumuagi-backend/models"
	"gorm.io/gorm/clause"
)

// SavePushToken signs this phone up for the notification digest
// (internal/notify.go), in the language the app is in. The app sends it on every
// launch and language change; a phone signed in as someone else before moves to
// the caller.
func SavePushToken(c *gin.Context) {
	username := c.GetString("username")

	var input struct {
		Token    string `json:"token" binding:"required"`
		Language string `json:"language"`
	}
	if err := c.ShouldBindJSON(&input); err != nil || !internal.IsExpoPushToken(input.Token) {
		log.Printf("[notify] save token for %s: invalid request (%v)", username, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid push token"})
		return
	}

	token := models.PushToken{Token: input.Token, Username: username, Language: internal.DigestLanguage(input.Language)}
	err := database.DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "token"}},
		DoUpdates: clause.AssignmentColumns([]string{"username", "language", "updated_at"}),
	}).Create(&token).Error
	if err != nil {
		log.Printf("[notify] save token for %s: %v", username, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save the push token"})
		return
	}

	log.Printf("[notify] %s gets notifications on a phone (%s)", username, token.Language)
	c.Status(http.StatusNoContent)
}

// DeletePushToken stops the digest reaching this phone, as the caller logs out
func DeletePushToken(c *gin.Context) {
	username := c.GetString("username")

	var input struct {
		Token string `json:"token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		log.Printf("[notify] delete token for %s: invalid request (%v)", username, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid push token"})
		return
	}

	res := database.DB.Where("token = ? AND username = ?", input.Token, username).Delete(&models.PushToken{})
	if res.Error != nil {
		log.Printf("[notify] delete token for %s: %v", username, res.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete the push token"})
		return
	}

	log.Printf("[notify] %s stopped notifications on %d phone(s)", username, res.RowsAffected)
	c.Status(http.StatusNoContent)
}
