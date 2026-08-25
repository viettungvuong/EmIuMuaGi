package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/viettungvuong/emiumuagi-user-service/database"
	"github.com/viettungvuong/emiumuagi-user-service/models"
	"gorm.io/gorm"
)

// Reasons a link attempt is rejected. They travel back as a "code" so the frontend
// can tell them apart instead of guessing from the status alone.
var (
	errNoSuchUser       = errors.New("no_such_user")
	errInviteNotFound   = errors.New("invite_not_found")
	errSelfLink         = errors.New("self_link")
	errAlreadyPartnered = errors.New("already_partnered")
	errPartnerTaken     = errors.New("partner_taken")
)

func AddPartner(c *gin.Context) {
	// Extract the user identity from the JWT claims already set by the middleware
	username := c.GetString("username")
	if username == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User identity not found in token"})
		return
	}

	inviteID := c.Param("inviteID")

	var partnerEmail string
	alreadyLinked := false

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		// Find the partner by invite link
		var partner models.User
		if err := tx.Where("invite_link = ?", inviteID).First(&partner).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errInviteNotFound
			}
			return err
		}

		// Prevent linking with self
		if partner.ID == username {
			return errSelfLink
		}

		var me models.User
		if err := tx.Where("id = ?", username).First(&me).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errNoSuchUser
			}
			return err
		}

		// One partner each: both sides have to be free.
		if me.PartnerID != nil {
			if *me.PartnerID == partner.ID {
				// Clicking the other half of an existing pair, nothing to do
				alreadyLinked = true
				partnerEmail = partner.Email
				return nil
			}
			return errAlreadyPartnered
		}
		if partner.PartnerID != nil {
			return errPartnerTaken
		}

		// Claim both sides in a fixed order so two links running at once cannot
		// deadlock, and guard on partner_id IS NULL so the loser of such a race
		// writes nothing instead of stealing a partner.
		links := [2]struct{ id, partnerID string }{
			{me.ID, partner.ID},
			{partner.ID, me.ID},
		}
		if links[0].id > links[1].id {
			links[0], links[1] = links[1], links[0]
		}
		for _, link := range links {
			res := tx.Model(&models.User{}).
				Where("id = ? AND partner_id IS NULL", link.id).
				Update("partner_id", link.partnerID)
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 0 {
				return errPartnerTaken
			}
		}

		// Burn the invite link now that it has been used
		newLink, err := models.NewInviteLink()
		if err != nil {
			return err
		}
		if err := tx.Model(&models.User{}).
			Where("id = ?", partner.ID).
			Update("invite_link", newLink).Error; err != nil {
			return err
		}

		partnerEmail = partner.Email
		return nil
	})

	switch {
	case err == nil:
	case errors.Is(err, errNoSuchUser):
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Your account no longer exists", "code": "no_such_user"})
		return
	case errors.Is(err, errInviteNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "User with this invite ID not found", "code": "invite_not_found"})
		return
	case errors.Is(err, errSelfLink):
		c.JSON(http.StatusConflict, gin.H{"error": "You cannot link with yourself", "code": "self_link"})
		return
	case errors.Is(err, errAlreadyPartnered):
		c.JSON(http.StatusConflict, gin.H{"error": "You already have a partner", "code": "already_partnered"})
		return
	case errors.Is(err, errPartnerTaken):
		c.JSON(http.StatusConflict, gin.H{"error": "That partner is already having a partner", "code": "partner_taken"})
		return
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not link you with that partner"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        "Partner linked successfully",
		"partner_email":  partnerEmail,
		"already_linked": alreadyLinked,
	})
}
