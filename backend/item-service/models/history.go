package models

import (
	"time"
)

type History struct {
	ID     uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	ItemID uint      `gorm:"not null" json:"item_id"`
	Item   Item      `gorm:"foreignKey:ItemID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"item"`
	Time   time.Time `json:"time"`
}
