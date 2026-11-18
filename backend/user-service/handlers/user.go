package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/viettungvuong/emiumuagi-user-service/database"
	"github.com/viettungvuong/emiumuagi-user-service/internal"
	"github.com/viettungvuong/emiumuagi-user-service/models"
	"gorm.io/gorm"
)

func GetMe(c *gin.Context) {
	username := c.GetString("username")
	if username == "" {
		log.Printf("[me] no user in token")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User identity not found in token. You have to sign in."})
		return
	}

	var user models.User
	if err := database.DB.Preload("Partner").Where("id = ?", username).First(&user).Error; err != nil {
		log.Printf("[me] %s: user not found (%v)", username, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	user.HasPassword = user.Password != ""
	c.JSON(http.StatusOK, user)
}

// DeleteAccount deletes the caller's account for good, once they type their
// password again (if they have one): first everything they added (items, purchases, ratings, dates)
// in the item service, then the partner link and the user. The partner keeps
// their account and items, just unlinked.
func DeleteAccount(c *gin.Context) {
	username := c.GetString("username")

	var req struct {
		Password string `json:"password"` // not asked of Google/Apple/Facebook-only accounts
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[account] delete %s: invalid request: %v", username, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var user models.User
	if err := database.DB.Where("id = ?", username).First(&user).Error; err != nil {
		log.Printf("[account] delete %s: user not found (%v)", username, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// 403, not 401: the apps take a 401 for an expired session
	if user.Password != "" && !internal.CheckPasswordHash(req.Password, user.Password) {
		log.Printf("[account] delete %s: wrong password", user.ID)
		c.JSON(http.StatusForbidden, gin.H{"error": "Incorrect password"})
		return
	}

	// Their items go first: if that fails the account is still there to try again
	if err := internal.DeleteItemData(c.Request.Context(), user.ID); err != nil {
		log.Printf("[account] delete %s: could not delete their items: %v", user.ID, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Could not delete your items"})
		return
	}

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		// Whoever points at them as partner (both sides, in case only one did)
		if err := tx.Model(&models.User{}).
			Where("id = ? OR partner_id = ?", user.ID, user.ID).
			Update("partner_id", nil).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", user.ID).Delete(&models.User{}).Error
	})
	if err != nil {
		log.Printf("[account] delete %s: could not delete the user: %v", user.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not delete your account"})
		return
	}

	if accessToken, _ := c.Cookie("access_token"); accessToken != "" {
		invalidateToken(accessToken)
	}
	c.SetCookie("access_token", "", -1, "/", "", false, true)
	c.SetCookie("refresh_token", "", -1, "/", "", false, true)

	partner := "none"
	if user.PartnerID != nil {
		partner = *user.PartnerID + " (unlinked)"
	}
	log.Printf("[account] deleted %s, partner: %s", user.ID, partner)
	c.JSON(http.StatusOK, gin.H{"message": "Account deleted"})
}
