package models

type Review struct {
	ID        uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	HistoryID uint    `gorm:"not null" json:"history_id"`
	History   History `gorm:"foreignKey:HistoryID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"history"`
	Score     int     `gorm:"not null" json:"score"`
}
