package handlers

import (
	"context"
	"errors"
	"fmt"
	"log"
	"math/rand/v2"
	"net/http"
	"regexp"
	"strings"
	"unicode"

	"github.com/gin-gonic/gin"
	"github.com/viettungvuong/emiumuagi-user-service/database"
	"github.com/viettungvuong/emiumuagi-user-service/internal"
	"github.com/viettungvuong/emiumuagi-user-service/models"
	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
	"gorm.io/gorm"
)

// A token from Google, Apple or Facebook's own sign-in, done in the app or on
// the web page. Name is what Apple tells the app on someone's first sign-in
// only, used to suggest a username. Username is sent only by someone new: the
// first answer asks for one (needsUsername), then the same token comes back with it.
type OAuthRequest struct {
	Provider string `json:"provider" binding:"required"`
	Token    string `json:"token" binding:"required"`
	Name     string `json:"name"`
	Username string `json:"username"`
}

var (
	errNoEmail         = errors.New("no_email")
	errEmailUnverified = errors.New("email_unverified")
	errNeedsUsername   = errors.New("needs_username")
	errUsernameTaken   = errors.New("username_taken")
)

var oauthVerifiers = map[string]func(context.Context, string) (internal.OAuthIdentity, error){
	"google":   internal.VerifyGoogle,
	"apple":    internal.VerifyApple,
	"facebook": internal.VerifyFacebook,
}

// OAuthLogin signs someone in with Google, Apple or Facebook: the account that
// sign-in was used for before, else the account with the same (provider-checked)
// email, else a new account with that email, under the username they send. No
// code is emailed: the provider has checked the address. Answers like Login,
// plus whether it was created; someone new who sent no username gets
// { needsUsername, email, suggestion } and no account yet.
// @Summary Sign in with Google, Apple or Facebook
// @Tags auth
// @Accept json
// @Produce json
// @Param request body OAuthRequest true "Provider and its token"
// @Success 200 {object} map[string]any
// @Failure 401 {object} map[string]string
// @Router /auth/oauth [post]
func OAuthLogin(c *gin.Context) {
	var req OAuthRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[oauth] invalid request: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	verify, ok := oauthVerifiers[req.Provider]
	if !ok {
		log.Printf("[oauth] unknown provider %q", req.Provider)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unknown sign-in provider"})
		return
	}

	id, err := verify(c.Request.Context(), req.Token)
	if errors.Is(err, internal.ErrOAuthNotConfigured) {
		log.Printf("[oauth] %s: not configured on this server", req.Provider)
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "This sign-in isn't set up yet"})
		return
	}
	if err != nil || id.Subject == "" {
		log.Printf("[oauth] %s: token rejected: %v", req.Provider, err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Could not verify your sign-in"})
		return
	}
	if id.Name == "" {
		id.Name = strings.TrimSpace(req.Name)
	}
	username := normalizeUsername(req.Username)
	if badUsername(c, username) {
		return
	}

	user, created, err := oauthUser(id, username)
	switch {
	case err == nil:
	case errors.Is(err, errNeedsUsername):
		suggestion, err := uniqueUsername(database.DB, id.Name, id.Email)
		if err != nil {
			log.Printf("[oauth] %s %s: could not suggest a username: %v", id.Provider, id.Subject, err)
		}
		log.Printf("[oauth] %s %s <%s>: new, asking for a username", id.Provider, id.Subject, id.Email)
		c.JSON(http.StatusOK, gin.H{"needsUsername": true, "email": id.Email, "suggestion": suggestion})
		return
	case errors.Is(err, errUsernameTaken):
		log.Printf("[oauth] %s %s: username %q is taken", id.Provider, id.Subject, username)
		c.JSON(http.StatusConflict, gin.H{"error": "That username is taken", "code": "username_taken"})
		return
	case errors.Is(err, errNoEmail):
		log.Printf("[oauth] %s %s: no email to make an account with", id.Provider, id.Subject)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Your account has no email address", "code": "no_email"})
		return
	case errors.Is(err, errEmailUnverified):
		log.Printf("[oauth] %s %s: <%s> is taken and the provider hasn't verified it", id.Provider, id.Subject, id.Email)
		c.JSON(http.StatusConflict, gin.H{"error": "Username or Email already exists", "code": "email_unverified"})
		return
	default:
		log.Printf("[oauth] %s %s <%s>: %v", id.Provider, id.Subject, id.Email, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not sign you in"})
		return
	}

	tokens, err := internal.GenerateTokens(user.ID)
	if err != nil {
		log.Printf("[oauth] %s: could not generate tokens: %v", user.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not generate token"})
		return
	}
	c.SetCookie("access_token", tokens.AccessToken, internal.AccessCookieMaxAge, "/", "", false, true)
	c.SetCookie("refresh_token", tokens.RefreshToken, internal.RefreshCookieMaxAge, "/", "", false, true)

	log.Printf("[oauth] %s: logged in with %s (new account: %t)", user.ID, id.Provider, created)
	c.JSON(http.StatusOK, gin.H{
		"message":  "Login successful",
		"token":    tokens,
		"username": user.ID,
		"created":  created,
	})
}

// oauthUser finds the account for a verified sign-in, or makes one named
// username (errNeedsUsername without it), and remembers the sign-in on it, so
// the next one finds it even if the email has changed
func oauthUser(id internal.OAuthIdentity, username string) (models.User, bool, error) {
	var user models.User
	created := false

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		var known models.Identity
		err := tx.Where("provider = ? AND subject = ?", id.Provider, id.Subject).First(&known).Error
		if err == nil {
			return tx.Where("id = ?", known.UserID).First(&user).Error
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		if id.Email == "" {
			return errNoEmail
		}
		err = tx.Where("lower(email) = lower(?)", id.Email).First(&user).Error
		switch {
		case err == nil:
			// Only an address the provider checked proves it's the same person
			if !id.EmailVerified {
				return errEmailUnverified
			}
		case errors.Is(err, gorm.ErrRecordNotFound):
			if username == "" {
				return errNeedsUsername
			}
			var taken int64
			if err := tx.Model(&models.User{}).Where("lower(id) = ?", username).Count(&taken).Error; err != nil {
				return err
			}
			if taken > 0 {
				return errUsernameTaken
			}
			user = models.User{ID: username, Email: id.Email} // no password: they sign in with the provider
			if err := tx.Create(&user).Error; err != nil {
				return err
			}
			created = true
		default:
			return err
		}

		return tx.Create(&models.Identity{Provider: id.Provider, Subject: id.Subject, UserID: user.ID}).Error
	})
	return user, created, err
}

var usernameJunk = regexp.MustCompile(`[^a-z0-9._]+`)

const maxUsernameLength = 20

// uniqueUsername suggests a username to someone new: their name without accents
// or spaces ("Vương Tùng" → "vuongtung"), else the start of their email, with a
// number added while it's taken
func uniqueUsername(tx *gorm.DB, name, email string) (string, error) {
	base := usernameFrom(name)
	if len(base) < 3 {
		base = usernameFrom(strings.SplitN(email, "@", 2)[0])
	}
	if len(base) < 3 {
		base = "user"
	}

	candidate := base
	for range 20 {
		var taken int64
		if err := tx.Model(&models.User{}).Where("lower(id) = ?", candidate).Count(&taken).Error; err != nil {
			return "", err
		}
		if taken == 0 {
			return candidate, nil
		}
		candidate = fmt.Sprintf("%s%d", base, 1000+rand.IntN(9000))
	}
	return "", errors.New("no free username")
}

func usernameFrom(s string) string {
	s = strings.NewReplacer("đ", "d", "Đ", "d").Replace(s)
	s, _, _ = transform.String(transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn))), s)
	s = strings.Trim(usernameJunk.ReplaceAllString(strings.ToLower(s), ""), "._")
	if len(s) > maxUsernameLength {
		s = s[:maxUsernameLength]
	}
	return s
}
