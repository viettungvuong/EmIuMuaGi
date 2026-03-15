package models

import (
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Review struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	HistoryID uuid.UUID `gorm:"type:uuid;not null" json:"history_id"`
	History   History   `gorm:"foreignKey:HistoryID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"history"`
	Score     int       `gorm:"not null" json:"score"`
	Content   string    `json:"content"`
}

func (r *Review) BeforeCreate(tx *gorm.DB) (err error) {
	if r.ID == uuid.Nil {
		r.ID, err = uuid.NewV7() // use UUIDv7
	}
	return
}
