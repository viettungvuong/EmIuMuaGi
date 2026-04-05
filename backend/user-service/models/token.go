package models

import "time"

type Token struct {
	AccessToken      string    `gorm:"primaryKey" json:"access_token"`
	RefreshToken     string    `gorm:"not null" json:"refresh_token"`
	AccessExpiresAt  time.Time `gorm:"not null" json:"access_expires_at"`
	RefreshExpiresAt time.Time `gorm:"not null" json:"refresh_expires_at"`
}
