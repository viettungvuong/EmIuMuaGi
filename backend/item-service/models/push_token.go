package models

import "time"

// A phone that gets the notification digest (internal/notify.go). Token is its
// Expo push token; a phone signed in as someone else before moves to whoever
// registered it last. Language is "vi" or "en", what the digest is written in.
type PushToken struct {
	Token     string    `gorm:"primaryKey;size:255" json:"token"`
	Username  string    `gorm:"size:255;not null;index" json:"-"`
	Language  string    `gorm:"size:5;not null;default:vi" json:"language"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"-"`
}
