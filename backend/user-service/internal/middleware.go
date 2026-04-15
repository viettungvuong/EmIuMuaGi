package internal

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString, err := c.Cookie("access_token")

		// If access token is present, try validating it
		if err == nil && tokenString != "" {
			claims := &Claims{}
			token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
				return []byte(os.Getenv("JWT_SECRET")), nil
			})

			if err == nil && token.Valid {
				c.Set("username", claims.Username)
				c.Next()
				return
			}
		}

		// If access token is missing or invalid, try using refresh token
		refreshToken, err := c.Cookie("refresh_token")
		if err == nil && refreshToken != "" {
			refreshClaims := &Claims{}
			refreshTokenObj, err := jwt.ParseWithClaims(refreshToken, refreshClaims, func(token *jwt.Token) (interface{}, error) {
				return []byte(os.Getenv("JWT_REFRESH_SECRET")), nil
			})

			if err == nil && refreshTokenObj.Valid {
				// Refresh token is valid! Generate a new access token
				newAccessToken, _, err := GenerateAccessToken(refreshClaims.Username)
				if err == nil {
					// Set the new cookie transparently
					c.SetCookie("access_token", newAccessToken, 30*60, "/", "", false, true)
					c.Set("username", refreshClaims.Username)
					c.Next()
					return
				}
			}
		}

		// Both tokens failed
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication failed. Please sign in again."})
		c.Abort()
	}
}
