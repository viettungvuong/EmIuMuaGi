package models

import (
	"errors"

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

const MAX_LENGTH_CONTENT = 256

func (r *Review) BeforeCreate(tx *gorm.DB) (err error) {
	if r.ID == uuid.Nil {
		r.ID, err = uuid.NewV7() // use UUIDv7
	}
	if r.Score < 0 || r.Score > 5 {
		return errors.New("Score must be between 0 and 5") // prevent it from being stored on DB
	}
	if len(r.Content) > MAX_LENGTH_CONTENT {
		return errors.New("Content is too long")
	}
	return
}
