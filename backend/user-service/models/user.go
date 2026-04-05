package models

import (
	gonanoid "github.com/matoous/go-nanoid/v2"
	"gorm.io/gorm"
)

type User struct {
	ID         string  `gorm:"primaryKey" json:"id"`
	Email      string  `gorm:"unique;not null" json:"email"`
	Password   string  `gorm:"not null" json:"-"`
	PartnerID  *string `json:"partner_id"`
	Partner    *User   `gorm:"foreignKey:PartnerID" json:"partner,omitempty"`
	InviteLink string  `gorm:"not null" json:"invite_link"`
}

func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	// Custom NanoID: No dashes, only alphanumeric, 12 characters long
	alphabet := "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
	id, err := gonanoid.Generate(alphabet, 12)

	if err != nil {
		return err
	}

	u.InviteLink = id
	return
}
