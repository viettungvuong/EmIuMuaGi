package internal

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

const itemDeleteTimeout = 30 * time.Second

func itemServiceURL() string {
	if url := os.Getenv("ITEM_SERVICE_URL"); url != "" {
		return url
	}
	return "http://localhost:8002"
}

// DeleteItemData asks the item service to remove everything username added
// there (see its /internal/account). It goes as them, with a fresh access token,
// so it works however the caller's own session was signed in.
func DeleteItemData(ctx context.Context, username string) error {
	accessToken, _, err := GenerateAccessToken(username)
	if err != nil {
		return fmt.Errorf("could not sign a token: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, itemDeleteTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, itemServiceURL()+"/internal/account", nil)
	if err != nil {
		return err
	}
	req.AddCookie(&http.Cookie{Name: "access_token", Value: accessToken})

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("item service answered %d", resp.StatusCode)
	}
	return nil
}

// The item service answers at once and reads the prices in the background
const priceRefreshTimeout = 5 * time.Second

// RefreshItemPrices asks the item service to read the prices off the shop links
// on username's list (and their partner's), now that they've signed in: prices
// are only read then (see its /internal/prices). Run it in a goroutine, so the
// sign-in doesn't wait for it; it goes as them, like DeleteItemData.
func RefreshItemPrices(username string) {
	accessToken, _, err := GenerateAccessToken(username)
	if err != nil {
		log.Printf("[prices] %s: could not sign a token: %v", username, err)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), priceRefreshTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, itemServiceURL()+"/internal/prices", nil)
	if err != nil {
		log.Printf("[prices] %s: %v", username, err)
		return
	}
	req.AddCookie(&http.Cookie{Name: "access_token", Value: accessToken})

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("[prices] %s: item service didn't answer: %v", username, err)
		return
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusAccepted {
		log.Printf("[prices] %s: item service answered %d", username, resp.StatusCode)
	}
}
