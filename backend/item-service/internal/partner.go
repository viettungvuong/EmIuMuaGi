package internal

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	partnerLookupTimeout = 3 * time.Second

	// Someone who has a partner keeps them, so that answer can be held a while.
	// "No partner yet" is the answer that goes stale, so it is re-checked often
	// and a fresh link shows up quickly.
	partnerTTL = 60 * time.Second
	singleTTL  = 10 * time.Second

	// When the user service is unhappy, wait 1s, 2s, 4s ... before asking again
	// instead of hammering it once per request
	backoffBase = time.Second
	backoffMax  = 30 * time.Second

	// How long a last-known-good answer may still be used during an outage
	staleGraceLimit = 5 * time.Minute
)

type partnerEntry struct {
	partner    string
	expiresAt  time.Time
	lastGood   time.Time
	failures   int
	retryAfter time.Time
}

var (
	partnerMu    sync.Mutex
	partnerCache = map[string]*partnerEntry{}
)

func userServiceURL() string {
	if url := os.Getenv("USER_SERVICE_URL"); url != "" {
		return url
	}
	return "http://localhost:8001"
}

// PartnerOf reports who a user is linked with, or "" when they are single.
// Items and users live in separate databases, so the answer has to come from the
// user service; the caller's own token is forwarded rather than a shared secret.
// Answers are cached, and repeated failures back off, so a page full of item
// requests does not turn into a page full of /api/me requests.
func PartnerOf(ctx context.Context, username, accessToken string) (string, error) {
	if partner, ok := cachedPartner(username); ok {
		return partner, nil
	}

	partner, err := fetchPartner(ctx, accessToken)
	if err != nil {
		return recordFailure(username), err
	}

	recordSuccess(username, partner)
	return partner, nil
}

// cachedPartner returns an answer that can be used without calling the user
// service: either a fresh one, or a recent one while the service is backing off.
func cachedPartner(username string) (string, bool) {
	partnerMu.Lock()
	defer partnerMu.Unlock()

	entry, ok := partnerCache[username]
	if !ok {
		return "", false
	}

	now := time.Now()
	if now.Before(entry.retryAfter) {
		// Too soon to ask again. Keep serving the last good answer unless it has
		// aged past the point where trusting it is reasonable.
		if now.Sub(entry.lastGood) < staleGraceLimit {
			return entry.partner, true
		}
		return "", true
	}

	if now.Before(entry.expiresAt) {
		return entry.partner, true
	}

	return "", false
}

func recordSuccess(username, partner string) {
	partnerMu.Lock()
	defer partnerMu.Unlock()

	ttl := singleTTL
	if partner != "" {
		ttl = partnerTTL
	}

	now := time.Now()
	partnerCache[username] = &partnerEntry{
		partner:   partner,
		expiresAt: now.Add(ttl),
		lastGood:  now,
	}
}

// recordFailure widens the backoff window and hands back the last good answer if
// there is one recent enough to keep using.
func recordFailure(username string) string {
	partnerMu.Lock()
	defer partnerMu.Unlock()

	entry, ok := partnerCache[username]
	if !ok {
		entry = &partnerEntry{}
		partnerCache[username] = entry
	}

	entry.failures++
	entry.expiresAt = time.Time{}

	backoff := backoffBase << uint(min(entry.failures-1, 5))
	if backoff > backoffMax {
		backoff = backoffMax
	}
	entry.retryAfter = time.Now().Add(backoff)

	if !entry.lastGood.IsZero() && time.Since(entry.lastGood) < staleGraceLimit {
		return entry.partner
	}
	return ""
}

func fetchPartner(ctx context.Context, accessToken string) (string, error) {
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
// once they have one. If the partner cannot be resolved it falls back to the
// caller alone, so a user service hiccup narrows what is shown instead of
// widening it. The error is returned for logging; the scope is still usable.
func OwnerScope(c *gin.Context) ([]string, error) {
	username := c.GetString("username")

	partner, err := PartnerOf(c.Request.Context(), username, c.GetString("access_token"))
	if partner == "" {
		return []string{username}, err
	}

	return []string{username, partner}, err
}
