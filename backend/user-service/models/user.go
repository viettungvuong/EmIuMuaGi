package models

import (
	"github.com/google/uuid"
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
	u.InviteLink = uuid.New().String()
	return
}
