package internal

import (
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/viettungvuong/emiumuagi-user-service/models"
)

type Claims struct {
	Username string `json:"username"`
	jwt.RegisteredClaims
}

const EXPIRY_MINUTES_ACCESS = 30
const EXPIRY_DAY_REFRESH = 7

func GenerateAccessToken(username string) (string, time.Time, error) {
	accessSecret := []byte(os.Getenv("JWT_SECRET"))
	expiresAt := time.Now().Add(EXPIRY_MINUTES_ACCESS * time.Minute)
	accessClaims := &Claims{
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	tokenString, err := accessToken.SignedString(accessSecret)
	return tokenString, expiresAt, err
}

func GenerateTokens(username string) (models.Token, error) {
	refreshSecret := []byte(os.Getenv("JWT_REFRESH_SECRET"))

	// Access Token
	accessString, accessExp, err := GenerateAccessToken(username)
	if err != nil {
		return models.Token{}, err
	}

	// Refresh Token
	refreshExp := time.Now().Add(EXPIRY_DAY_REFRESH * 24 * time.Hour)
	refreshClaims := &Claims{
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(refreshExp),
		},
	}
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshString, err := refreshToken.SignedString(refreshSecret)
	if err != nil {
		return models.Token{}, err
	}

	return models.Token{
		AccessToken:      accessString,
		RefreshToken:     refreshString,
		AccessExpiresAt:  accessExp,
		RefreshExpiresAt: refreshExp,
	}, nil
}
