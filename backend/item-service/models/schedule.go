package models

import "time"

// A date to go eat at a restaurant. Username is whoever booked it: users live in
// the user service's own database, so like items.owner it is a plain username
// rather than a foreign key.
type Schedule struct {
	ID           uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	ScheduledAt  time.Time  `gorm:"not null;index" json:"scheduled_at"`
	RestaurantID uint       `gorm:"not null;index" json:"restaurant_id"`
	Restaurant   Restaurant `gorm:"foreignKey:RestaurantID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`
	Username     string     `gorm:"size:255;not null;index" json:"username"`
	CreatedAt    time.Time  `gorm:"autoCreateTime" json:"created_at"`
}
