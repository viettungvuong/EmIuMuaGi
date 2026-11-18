package internal

import (
	"context"
	"fmt"
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
