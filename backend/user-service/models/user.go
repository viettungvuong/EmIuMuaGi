package models

import (
	gonanoid "github.com/matoous/go-nanoid/v2"
	"gorm.io/gorm"
)

// A user has at most one partner. The unique index on PartnerID keeps two users
// from claiming the same person, and AddPartner keeps both sides of a pair in sync.
type User struct {
	ID         string  `gorm:"primaryKey" json:"id"`
	Email      string  `gorm:"unique;not null" json:"email"`
	Password   string  `gorm:"not null" json:"-"`
	PartnerID  *string `gorm:"uniqueIndex" json:"partner_id"`
	Partner    *User   `gorm:"foreignKey:PartnerID" json:"partner,omitempty"`
	InviteLink string  `gorm:"not null" json:"invite_link"`
}

// NewInviteLink builds an invite ID: no dashes, only alphanumeric, 12 characters long
func NewInviteLink() (string, error) {
	alphabet := "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
	return gonanoid.Generate(alphabet, 12)
}

func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	id, err := NewInviteLink()
	if err != nil {
		return err
	}

	u.InviteLink = id
	return
}
