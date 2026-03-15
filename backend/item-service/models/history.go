package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type History struct {
	ID     uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	ItemID uint      `gorm:"not null" json:"item_id"`
	Item   Item      `gorm:"foreignKey:ItemID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"item"`
	Time   time.Time `json:"time"`
}

func (h *History) BeforeCreate(tx *gorm.DB) (err error) {
	if h.ID == uuid.Nil {
		h.ID, err = uuid.NewV7() // use UUIDv7
	}
	return
}
