package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/viettungvuong/emiumuagi-user-service/internal"
)

const testRefreshSecret = "test-refresh-secret"

func refreshCookie(t *testing.T, method jwt.SigningMethod, secret string, exp *time.Time) *http.Cookie {
	t.Helper()
	claims := &internal.Claims{Username: "tung"}
	if exp != nil {
		claims.ExpiresAt = jwt.NewNumericDate(*exp)
	}
	signed, err := jwt.NewWithClaims(method, claims).SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}
	return &http.Cookie{Name: "refresh_token", Value: signed}
}

// The refresh tokens turned down before the account is looked up
func TestRefreshTokenRejects(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("JWT_REFRESH_SECRET", testRefreshSecret)
	past, future := time.Now().Add(-time.Minute), time.Now().Add(time.Hour)

	cases := []struct {
		name   string
		cookie *http.Cookie
		want   string
	}{
		{"no cookie", nil, "Refresh token missing"},
		{"expired", refreshCookie(t, jwt.SigningMethodHS256, testRefreshSecret, &past), "Refresh token expired"},
		{"someone else's secret", refreshCookie(t, jwt.SigningMethodHS256, "not-ours", &future), "Invalid or expired refresh token"},
		{"another algorithm", refreshCookie(t, jwt.SigningMethodHS512, testRefreshSecret, &future), "Invalid or expired refresh token"},
		{"no expiry", refreshCookie(t, jwt.SigningMethodHS256, testRefreshSecret, nil), "Invalid or expired refresh token"},
		{"an access token", refreshCookie(t, jwt.SigningMethodHS256, "the-access-secret", &future), "Invalid or expired refresh token"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest(http.MethodGet, "/api/auth/refresh", nil)
			if tc.cookie != nil {
				c.Request.AddCookie(tc.cookie)
			}

			RefreshToken(c)

			var body struct{ Error string }
			_ = json.Unmarshal(w.Body.Bytes(), &body)
			if w.Code != http.StatusUnauthorized || body.Error != tc.want {
				t.Errorf("got %d %q, want 401 %q", w.Code, body.Error, tc.want)
			}
			if w.Header().Get("Set-Cookie") != "" {
				t.Errorf("set a cookie: %s", w.Header().Get("Set-Cookie"))
			}
		})
	}
}

// Signing in gives a 2-hour access token and a 1-month refresh token, each in a
// cookie that lasts as long
func TestTokenLifetimes(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-access-secret")
	t.Setenv("JWT_REFRESH_SECRET", testRefreshSecret)
	tokens, err := internal.GenerateTokens("tung")
	if err != nil {
		t.Fatal(err)
	}

	month := 30 * 24 * time.Hour
	for _, tc := range []struct {
		name      string
		expiresAt time.Time
		cookieAge int
		want      time.Duration
	}{
		{"access", tokens.AccessExpiresAt, internal.AccessCookieMaxAge, 2 * time.Hour},
		{"refresh", tokens.RefreshExpiresAt, internal.RefreshCookieMaxAge, month},
	} {
		if left := time.Until(tc.expiresAt); left < tc.want-time.Minute || left > tc.want {
			t.Errorf("%s token lasts %s, want %s", tc.name, left, tc.want)
		}
		if time.Duration(tc.cookieAge)*time.Second != tc.want {
			t.Errorf("%s cookie Max-Age %ds, want %s", tc.name, tc.cookieAge, tc.want)
		}
	}

	// The refresh token's own expiry says the same as the one returned
	claims := &internal.Claims{}
	if _, err := jwt.ParseWithClaims(tokens.RefreshToken, claims, func(*jwt.Token) (any, error) {
		return []byte(testRefreshSecret), nil
	}); err != nil || !claims.ExpiresAt.Time.Equal(tokens.RefreshExpiresAt.Truncate(time.Second)) {
		t.Errorf("refresh token's exp %v (%v), want %v", claims.ExpiresAt, err, tokens.RefreshExpiresAt)
	}
}
