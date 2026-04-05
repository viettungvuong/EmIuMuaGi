package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/viettungvuong/emiumuagi-user-service/database"
	"github.com/viettungvuong/emiumuagi-user-service/models"
)

func AddPartner(c *gin.Context) {
	// Extract the user identity from the JWT claims already set by the middleware
	username := c.GetString("username")
	if username == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User identity not found in token"})
		return
	}

	inviteID := c.Param("inviteID")

	// Find the partner by invite link
	var partner models.User
	if err := database.DB.Where("invite_link = ?", inviteID).First(&partner).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User with this invite ID not found"})
		return
	}

	// Prevent linking with self
	if partner.ID == username {
		c.JSON(http.StatusConflict, gin.H{"error": "You cannot link with yourself"})
		return
	}

	// Cannot add that partner when he/she already have a partner
	if partner.PartnerID != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "That partner is already having a partner"})
		return
	}

	// Update current user's partner ID
	if err := database.DB.Model(&models.User{}).Where("id = ?", username).Update("partner_id", partner.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not update your partner ID"})
		return
	}

	// reupdate invite link of that partner
	partner.InviteLink = uuid.New().String()

	c.JSON(http.StatusOK, gin.H{
		"message":       "Partner linked successfully",
		"partner_email": partner.Email,
	})
}
