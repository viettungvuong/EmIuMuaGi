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

func GenerateTokens(username string) (string, string, error) {
	accessSecret := []byte(os.Getenv("JWT_SECRET"))
	refreshSecret := []byte(os.Getenv("JWT_REFRESH_SECRET"))

	// Access Token
	accessClaims := &Claims{
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(EXPIRY_MINUTES_ACCESS * time.Minute)),
		},
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessString, err := accessToken.SignedString(accessSecret)
	if err != nil {
		return "", "", err
	}

	// Refresh Token
	refreshClaims := &Claims{
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(EXPIRY_DAY_REFRESH * time.Minute)), // refresh token must be valid for longer
		},
	}
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshString, err := refreshToken.SignedString(refreshSecret)
	if err != nil {
		return "", "", err
	}

	return accessString, refreshString, nil
}
