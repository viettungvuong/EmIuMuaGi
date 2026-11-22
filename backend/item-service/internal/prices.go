package internal

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/viettungvuong/emiumuagi-backend/database"
	"github.com/viettungvuong/emiumuagi-backend/models"
)

// Prices off the items' shop pages, read lazily: only when someone signs in (the
// user service calls /internal/prices then), never while the list loads. The ai
// service decides which links it can price – Shopee's, so far – and reads them
// (its app/core/parsing.py); this side picks the items and keeps what it finds.

const (
	// A sign-in soon after another (the partner's, the other phone's) doesn't
	// read the same pages again
	priceRecheckAfter = 6 * time.Hour
	// Pages take a few seconds each; the ai service stops at 10 minutes
	priceReadTimeout = 12 * time.Minute
)

func aiServiceURL() string {
	if url := os.Getenv("AI_SERVICE_URL"); url != "" {
		return url
	}
	return "http://localhost:8004"
}

// The couples whose prices are being read, so signing in twice in a row
// doesn't read them twice at once
var pricing sync.Map

// RefreshPrices reads, in the background, the prices of the items on the
// owners' list (a couple, or one person) that are still to buy
func RefreshPrices(owners []string) {
	key := slices.Clone(owners)
	slices.Sort(key)
	scope := strings.Join(key, ",")
	if _, busy := pricing.LoadOrStore(scope, true); busy {
		log.Printf("[prices] %s: already being read", scope)
		return
	}

	go func() {
		defer pricing.Delete(scope)
		if err := refreshPrices(owners); err != nil {
			log.Printf("[prices] %s: %v", scope, err)
		}
	}()
}

type priceLink struct {
	ID  uint   `json:"id"`
	URL string `json:"url"`
}

func refreshPrices(owners []string) error {
	// Every link still to buy: which sites can be priced is the ai service's call
	var links []priceLink
	err := database.DB.Model(&models.Item{}).
		Select("id, buy_url AS url").
		Where("owner IN ? AND deleted_at IS NULL AND NOT bought AND buy_url IS NOT NULL AND buy_url <> ''", owners).
		Where("price_checked_at IS NULL OR price_checked_at < ?", time.Now().Add(-priceRecheckAfter)).
		Scan(&links).Error
	if err != nil {
		return fmt.Errorf("could not load links: %w", err)
	}
	if len(links) == 0 {
		return nil
	}

	results, err := readPrices(links)
	if err != nil {
		return fmt.Errorf("ai service: %w", err)
	}

	// Keep the last price found when a page no longer shows one
	now := time.Now()
	priced := 0
	for _, r := range results {
		update := map[string]any{"price_checked_at": now}
		if r.Price != nil {
			update["price"] = *r.Price
			priced++
		}
		if err := database.DB.Model(&models.Item{}).Where("id = ?", r.ID).Updates(update).Error; err != nil {
			log.Printf("[prices] item #%d: could not save its price: %v", r.ID, err)
		}
	}

	log.Printf("[prices] %v: %d of %d link(s) read, %d priced", owners, len(results), len(links), priced)
	return nil
}

type priceResult struct {
	ID    uint    `json:"id"`
	Price *string `json:"price"`
}

// readPrices asks the ai service for the links' prices; it answers only for
// pages it read
func readPrices(links []priceLink) ([]priceResult, error) {
	body, err := json.Marshal(map[string]any{"links": links})
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), priceReadTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, aiServiceURL()+"/internal/prices", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("answered %d", resp.StatusCode)
	}

	var answer struct {
		Results []priceResult `json:"results"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&answer); err != nil {
		return nil, err
	}
	return answer.Results, nil
}
