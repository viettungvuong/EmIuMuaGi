package models

type User struct {
	ID       string `gorm:"primaryKey" json:"id"`
	Password string `gorm:"not null" json:"-"`
}
