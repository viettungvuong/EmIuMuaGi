package internal

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
)

const partnerLookupTimeout = 3 * time.Second

func userServiceURL() string {
	if url := os.Getenv("USER_SERVICE_URL"); url != "" {
		return url
	}
	return "http://localhost:8001"
}

// PartnerOf asks the user service who the caller is partnered with, or "" if
// they are on their own
func PartnerOf(ctx context.Context, accessToken string) (string, error) {
	if accessToken == "" {
		return "", fmt.Errorf("no access token to forward")
	}

	ctx, cancel := context.WithTimeout(ctx, partnerLookupTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, userServiceURL()+"/api/me", nil)
	if err != nil {
		return "", err
	}
	req.AddCookie(&http.Cookie{Name: "access_token", Value: accessToken})

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("user service answered %d", resp.StatusCode)
	}

	var body struct {
		PartnerID *string `json:"partner_id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", err
	}

	if body.PartnerID == nil {
		return "", nil
	}
	return *body.PartnerID, nil
}

// OwnerScope lists whose items the caller may see: themselves plus their partner
func OwnerScope(c *gin.Context) ([]string, error) {
	username := c.GetString("username")

	partner, err := PartnerOf(c.Request.Context(), c.GetString("access_token"))
	if partner == "" {
		return []string{username}, err
	}

	return []string{username, partner}, err
}
