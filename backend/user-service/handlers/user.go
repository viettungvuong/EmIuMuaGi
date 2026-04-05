package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/viettungvuong/emiumuagi-user-service/database"
	"github.com/viettungvuong/emiumuagi-user-service/models"
)

func GetMe(c *gin.Context) {
	username := c.GetString("username")
	if username == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User identity not found in token. You have to sign in."})
		return
	}

	var user models.User
	if err := database.DB.Preload("Partner").Where("id = ?", username).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}
