package handlers

import (
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/viettungvuong/emiumuagi-user-service/database"
	"github.com/viettungvuong/emiumuagi-user-service/internal"
	"github.com/viettungvuong/emiumuagi-user-service/models"
)

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type SignupRequest struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// SignUp's fields again, plus the OTP it emailed
type VerifySignupRequest struct {
	SignupRequest
	OTP string `json:"otp" binding:"required,len=6,numeric"`
}

type AuthResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type ChangePasswordRequest struct {
	OldPassword      string `json:"oldPassword"`
	NewPassword      string `json:"newPassword"`
	OldPasswordSnake string `json:"old_password,omitempty"`
	NewPasswordSnake string `json:"new_password,omitempty"`
}

// SignUp starts registration: if the username and email are free, it emails an OTP
// @Summary Register a new user
// @Description Check that the username and email are free, then email a 6-digit OTP. Send it to /auth/signup/verify to create the user.
// @Tags auth
// @Accept json
// @Produce json
// @Param signup body SignupRequest true "Signup details"
// @Success 201 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 409 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /auth/signup [post]
func SignUp(c *gin.Context) {
	var req SignupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Turn away a taken username or email now, not after the user has fetched the code
	var taken int64
	if err := database.DB.Model(&models.User{}).
		Where("id = ? OR email = ?", req.Username, req.Email).
		Count(&taken).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not check username and email"})
		return
	}
	if taken > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Username or Email already exists"})
		return
	}

	if err := GenerateOTP(req.Email); err != nil {
		log.Printf("SignUp: could not send OTP to %s: %v", req.Email, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not send OTP: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "OTP sent successfully"})
}

// VerifySignUp creates the user once the OTP that SignUp emailed checks out
// @Summary Verify signup OTP
// @Description Check the OTP emailed by /auth/signup, then create the user with username, email, and password
// @Tags auth
// @Accept json
// @Produce json
// @Param signup body VerifySignupRequest true "Signup details and OTP"
// @Success 201 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 409 {object} map[string]string
// @Router /auth/signup/verify [post]
func VerifySignUp(c *gin.Context) {
	var req VerifySignupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	ok, err := VerifyOTP(req.Email, req.OTP)
	if err != nil {
		log.Printf("VerifySignUp: could not verify OTP for %s: %v", req.Email, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not verify OTP: " + err.Error()})
		return
	}
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired OTP"})
		return
	}

	hashedPassword, err := internal.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not hash password"})
		return
	}

	user := models.User{
		ID:       req.Username,
		Email:    req.Email,
		Password: hashedPassword,
	} // create new object

	if err := database.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Username or Email already exists"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "User created successfully"})
}

// Login handles user authentication
// @Summary User login
// @Description Authenticate user and return JWT tokens
// @Tags auth
// @Accept json
// @Produce json
// @Param login body LoginRequest true "Login credentials"
// @Success 200 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /auth/login [post]
func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var user models.User
	if err := database.DB.Where("id = ?", req.Username).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	if !internal.CheckPasswordHash(req.Password, user.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid password"})
		return
	}

	tokens, err := internal.GenerateTokens(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not generate token"})
		return
	}

	// Set HttpOnly cookies for both tokens
	c.SetCookie("access_token", tokens.AccessToken, 30*60, "/", "", false, true)
	c.SetCookie("refresh_token", tokens.RefreshToken, 3600*24*7, "/", "", false, true)

	c.JSON(http.StatusOK, gin.H{
		"message": "Login successful",
		"token":   tokens,
	})
}

func RefreshToken(c *gin.Context) {
	refreshToken, err := c.Cookie("refresh_token") // extract from cookie
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Refresh token missing"})
		return
	}

	claims := &internal.Claims{}
	token, err := jwt.ParseWithClaims(refreshToken, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(os.Getenv("JWT_REFRESH_SECRET")), nil
	})

	if err != nil || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired refresh token"})
		return
	}

	accessToken, accessExp, err := internal.GenerateAccessToken(claims.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not generate access token"})
		return
	}

	c.SetCookie("access_token", accessToken, 30*60, "/", "", false, true) // 30 min access token cookie

	// Add new token to database
	newToken := models.Token{
		AccessToken:      accessToken,
		RefreshToken:     refreshToken,
		AccessExpiresAt:  accessExp,
		RefreshExpiresAt: claims.ExpiresAt.Time,
	}
	if err := database.DB.Create(&newToken).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not save token to database"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token": accessToken,
		"expires_at":   accessExp,
	})
}

// CheckSignedIn returns 200 OK if the user is authenticated
// @Summary Check if user is signed in
// @Description Verify status of access token from cookie
// @Tags auth
// @Produce json
// @Success 200 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /auth/check [get]
func CheckSignedIn(c *gin.Context) {
	username, exists := c.Get("username")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not signed in"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"authenticated": true,
		"username":      username,
	})
}

// ChangePassword verifies the user's current password and updates it to a new one
// @Summary Change user password
// @Description Verify old password against the hashed password in the database and update to the new password
// @Tags auth
// @Accept json
// @Produce json
// @Param request body ChangePasswordRequest true "Old and new password"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /auth/change-password [post]
func ChangePassword(c *gin.Context) {
	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.OldPassword == "" {
		req.OldPassword = req.OldPasswordSnake
	}
	if req.NewPassword == "" {
		req.NewPassword = req.NewPasswordSnake
	}

	if req.OldPassword == "" || req.NewPassword == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Both oldPassword and newPassword are required"})
		return
	}

	// Extract and verify JWT from access_token cookie or Authorization header
	tokenString, err := c.Cookie("access_token")
	if err != nil || tokenString == "" {
		authHeader := c.GetHeader("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenString = strings.TrimPrefix(authHeader, "Bearer ")
		}
	}

	var username string
	if tokenString != "" {
		claims := &internal.Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return []byte(os.Getenv("JWT_SECRET")), nil
		})
		if err == nil && token.Valid {
			username = claims.Username
		}
	}

	// If access token is missing or expired, try the refresh token JWT
	if username == "" {
		if refreshToken, err := c.Cookie("refresh_token"); err == nil && refreshToken != "" {
			refreshClaims := &internal.Claims{}
			token, err := jwt.ParseWithClaims(refreshToken, refreshClaims, func(token *jwt.Token) (interface{}, error) {
				return []byte(os.Getenv("JWT_REFRESH_SECRET")), nil
			})
			if err == nil && token.Valid {
				username = refreshClaims.Username
			}
		}
	}

	if username == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
		return
	}

	var user models.User
	if err := database.DB.Where("id = ?", username).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Verify oldPassword against hashed password stored in the database
	if !internal.CheckPasswordHash(req.OldPassword, user.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Incorrect old password"})
		return
	}

	// Only set new password if old password was correct
	hashedNewPassword, err := internal.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not hash new password"})
		return
	}

	if err := database.DB.Model(&models.User{}).Where("id = ?", user.ID).Update("password", hashedNewPassword).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not update password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password changed successfully"})
}

func SignOut(c *gin.Context) {
	accessToken, _ := c.Cookie("access_token")
	if accessToken != "" {
		invalidateToken(accessToken)
	}

	// Clear the cookies by setting MaxAge to -1
	// Clear tokens => prevent username in c from being set too
	c.SetCookie("access_token", "", -1, "/", "", false, true)
	c.SetCookie("refresh_token", "", -1, "/", "", false, true)

	c.JSON(http.StatusOK, gin.H{
		"message": "Signed out successfully",
	})
}

// make token expire
func invalidateToken(accessToken string) {
	database.DB.Model(&models.Token{}).Where("access_token = ?", accessToken).Updates(map[string]interface{}{
		"access_expires_at":  time.Now(),
		"refresh_expires_at": time.Now(),
	})
}
