package internal

import (
	"context"
	"crypto/hmac"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"net/url"
	"os"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Who a Google, Apple or Facebook sign-in says the person is. Subject is the
// provider's own id for them, the same at every sign-in.
type OAuthIdentity struct {
	Provider      string
	Subject       string
	Email         string
	EmailVerified bool
	Name          string
}

// ErrOAuthNotConfigured: the provider's ids aren't in this service's environment
var ErrOAuthNotConfigured = errors.New("provider not configured")

const oauthHTTPTimeout = 10 * time.Second

// Comma-separated env list, empty entries dropped
func envList(name string) []string {
	var out []string
	for _, v := range strings.Split(os.Getenv(name), ",") {
		if v = strings.TrimSpace(v); v != "" {
			out = append(out, v)
		}
	}
	return out
}

// A provider's signing keys, fetched when first needed and again when a token
// names a key we don't have (they rotate) or after keysMaxAge
type jwks struct {
	url     string
	mu      sync.Mutex
	keys    map[string]*rsa.PublicKey
	fetched time.Time
}

const keysMaxAge = 6 * time.Hour

var (
	googleKeys   = &jwks{url: "https://www.googleapis.com/oauth2/v3/certs"}
	appleKeys    = &jwks{url: "https://appleid.apple.com/auth/keys"}
	facebookKeys = &jwks{url: "https://limited.facebook.com/.well-known/oauth/openid/jwks/"}
)

func (k *jwks) key(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	k.mu.Lock()
	defer k.mu.Unlock()

	if key, ok := k.keys[kid]; ok && time.Since(k.fetched) < keysMaxAge {
		return key, nil
	}
	if err := k.fetch(ctx); err != nil {
		return nil, err
	}
	if key, ok := k.keys[kid]; ok {
		return key, nil
	}
	return nil, fmt.Errorf("no signing key %q at %s", kid, k.url)
}

func (k *jwks) fetch(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, oauthHTTPTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, k.url, nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%s answered %d", k.url, resp.StatusCode)
	}

	var body struct {
		Keys []struct {
			Kid string `json:"kid"`
			Kty string `json:"kty"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return err
	}

	keys := map[string]*rsa.PublicKey{}
	for _, jk := range body.Keys {
		if jk.Kty != "RSA" {
			continue
		}
		n, err1 := base64.RawURLEncoding.DecodeString(jk.N)
		e, err2 := base64.RawURLEncoding.DecodeString(jk.E)
		if err1 != nil || err2 != nil {
			continue
		}
		keys[jk.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(n), E: int(new(big.Int).SetBytes(e).Int64())}
	}
	k.keys, k.fetched = keys, time.Now()
	return nil
}

// parseIDToken checks an OpenID ID token's signature against keys, that it hasn't
// expired, and that one of issuers made it for one of audiences
func parseIDToken(ctx context.Context, raw string, keys *jwks, issuers, audiences []string) (jwt.MapClaims, error) {
	claims := jwt.MapClaims{}
	_, err := jwt.ParseWithClaims(raw, claims, func(t *jwt.Token) (any, error) {
		kid, _ := t.Header["kid"].(string)
		return keys.key(ctx, kid)
	}, jwt.WithValidMethods([]string{"RS256"}), jwt.WithExpirationRequired())
	if err != nil {
		return nil, err
	}

	iss, _ := claims.GetIssuer()
	if !slices.Contains(issuers, iss) {
		return nil, fmt.Errorf("issued by %q", iss)
	}
	aud, _ := claims.GetAudience()
	if !slices.ContainsFunc(aud, func(a string) bool { return slices.Contains(audiences, a) }) {
		return nil, fmt.Errorf("meant for %v", aud)
	}
	return claims, nil
}

// Apple sends email_verified as "true"; Google as true
func claimTrue(claims jwt.MapClaims, name string) bool {
	switch v := claims[name].(type) {
	case bool:
		return v
	case string:
		return v == "true"
	}
	return false
}

func claimString(claims jwt.MapClaims, name string) string {
	s, _ := claims[name].(string)
	return s
}

// VerifyGoogle checks an ID token from Google Sign-In (the apps' native button
// or the web's Google button). GOOGLE_CLIENT_IDS lists the OAuth client ids it
// may be for: the web client's, which the apps also ask for, plus iOS's.
func VerifyGoogle(ctx context.Context, idToken string) (OAuthIdentity, error) {
	audiences := envList("GOOGLE_CLIENT_IDS")
	if len(audiences) == 0 {
		return OAuthIdentity{}, ErrOAuthNotConfigured
	}
	claims, err := parseIDToken(ctx, idToken, googleKeys, []string{"https://accounts.google.com", "accounts.google.com"}, audiences)
	if err != nil {
		return OAuthIdentity{}, err
	}
	return OAuthIdentity{
		Provider:      "google",
		Subject:       claimString(claims, "sub"),
		Email:         claimString(claims, "email"),
		EmailVerified: claimTrue(claims, "email_verified"),
		Name:          claimString(claims, "name"),
	}, nil
}

// VerifyApple checks an identity token from Sign in with Apple on iOS. Its
// audience is the app's bundle id; APPLE_AUDIENCES overrides it. Apple only
// tells the app the person's name, so that comes from the app (hint).
func VerifyApple(ctx context.Context, idToken string) (OAuthIdentity, error) {
	audiences := envList("APPLE_AUDIENCES")
	if len(audiences) == 0 {
		audiences = []string{"com.viettungvuong.emiumuagi"}
	}
	claims, err := parseIDToken(ctx, idToken, appleKeys, []string{"https://appleid.apple.com"}, audiences)
	if err != nil {
		return OAuthIdentity{}, err
	}
	return OAuthIdentity{
		Provider:      "apple",
		Subject:       claimString(claims, "sub"),
		Email:         claimString(claims, "email"),
		EmailVerified: claimTrue(claims, "email_verified"),
	}, nil
}

// VerifyFacebook checks a Facebook login. On iOS the SDK's Limited Login gives an
// OpenID token (a JWT); elsewhere it's an access token, which Graph API vouches
// for. Needs FACEBOOK_APP_ID, and FACEBOOK_APP_SECRET for access tokens.
func VerifyFacebook(ctx context.Context, token string) (OAuthIdentity, error) {
	appID := os.Getenv("FACEBOOK_APP_ID")
	if appID == "" {
		return OAuthIdentity{}, ErrOAuthNotConfigured
	}

	if strings.Count(token, ".") == 2 {
		claims, err := parseIDToken(ctx, token, facebookKeys, []string{"https://www.facebook.com", "https://limited.facebook.com"}, []string{appID})
		if err != nil {
			return OAuthIdentity{}, err
		}
		// Facebook only shares an address the person has confirmed
		email := claimString(claims, "email")
		return OAuthIdentity{
			Provider:      "facebook",
			Subject:       claimString(claims, "sub"),
			Email:         email,
			EmailVerified: email != "",
			Name:          claimString(claims, "name"),
		}, nil
	}

	secret := os.Getenv("FACEBOOK_APP_SECRET")
	if secret == "" {
		return OAuthIdentity{}, ErrOAuthNotConfigured
	}

	// First: is this token from our app and still good? (a token from another
	// app would otherwise get its holder into the account)
	var debug struct {
		Data struct {
			AppID   string `json:"app_id"`
			IsValid bool   `json:"is_valid"`
			UserID  string `json:"user_id"`
		} `json:"data"`
	}
	err := graphGet(ctx, "debug_token", url.Values{"input_token": {token}, "access_token": {appID + "|" + secret}}, &debug)
	if err != nil {
		return OAuthIdentity{}, err
	}
	if !debug.Data.IsValid || debug.Data.AppID != appID {
		return OAuthIdentity{}, fmt.Errorf("token for app %q, valid: %t", debug.Data.AppID, debug.Data.IsValid)
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(token))
	var me struct {
		ID    string `json:"id"`
		Name  string `json:"name"`
		Email string `json:"email"`
	}
	err = graphGet(ctx, "me", url.Values{
		"fields":          {"id,name,email"},
		"access_token":    {token},
		"appsecret_proof": {hex.EncodeToString(mac.Sum(nil))},
	}, &me)
	if err != nil {
		return OAuthIdentity{}, err
	}
	if me.ID != debug.Data.UserID {
		return OAuthIdentity{}, fmt.Errorf("token is for %s but /me is %s", debug.Data.UserID, me.ID)
	}
	return OAuthIdentity{Provider: "facebook", Subject: me.ID, Email: me.Email, EmailVerified: me.Email != "", Name: me.Name}, nil
}

func graphGet(ctx context.Context, path string, query url.Values, out any) error {
	ctx, cancel := context.WithTimeout(ctx, oauthHTTPTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://graph.facebook.com/"+path+"?"+query.Encode(), nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("graph %s answered %d", path, resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}
