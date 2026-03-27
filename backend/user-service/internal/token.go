package internal

import (
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	Username string `json:"username"`
	jwt.RegisteredClaims
}

const EXPIRY_MINUTES_ACCESS = 30
const EXPIRY_DAY_REFRESH = 7

func GenerateAccessToken(username string) (string, error) {
	accessSecret := []byte(os.Getenv("JWT_SECRET"))
	accessClaims := &Claims{
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(EXPIRY_MINUTES_ACCESS * time.Minute)),
		},
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	return accessToken.SignedString(accessSecret)
}

func GenerateTokens(username string) (string, string, error) {
	refreshSecret := []byte(os.Getenv("JWT_REFRESH_SECRET"))

	// Access Token
	accessString, err := GenerateAccessToken(username)
	if err != nil {
		return "", "", err
	}

	// Refresh Token
	refreshClaims := &Claims{
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(EXPIRY_DAY_REFRESH * 24 * time.Hour)), // Usually refresh tokens are valid for days
		},
	}
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshString, err := refreshToken.SignedString(refreshSecret)
	if err != nil {
		return "", "", err
	}

	return accessString, refreshString, nil
}
