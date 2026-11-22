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

// Access tokens are short-lived: 2 hours. The apps get a new one from the
// refresh token every time they're opened (GET /api/auth/refresh), and on a 401.
const EXPIRY_MINUTES_ACCESS = 2 * 60

// Refresh tokens last a month from signing in; after that, sign in again
const EXPIRY_DAY_REFRESH = 30

// The cookies' Max-Age, in seconds: as long as the token inside each
const (
	AccessCookieMaxAge  = EXPIRY_MINUTES_ACCESS * 60
	RefreshCookieMaxAge = EXPIRY_DAY_REFRESH * 24 * 60 * 60
)

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
