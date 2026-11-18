package models

import "time"

// A Google, Apple or Facebook sign-in tied to a user. Subject is the provider's
// id for the person, which stays the same however their name or email changes.
// Deleting the user deletes these with it.
type Identity struct {
	Provider  string    `gorm:"primaryKey;size:20" json:"provider"`
	Subject   string    `gorm:"primaryKey;size:255" json:"-"`
	UserID    string    `gorm:"not null;index" json:"-"`
	User      User      `gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
}
