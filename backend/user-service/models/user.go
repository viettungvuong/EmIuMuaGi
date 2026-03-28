package models

type User struct {
	ID        string `gorm:"primaryKey" json:"id"`
	Email     string `gorm:"unique;not null" json:"email"`
	Password  string `gorm:"not null" json:"-"`
	PartnerID *string `json:"partner_id"`
	Partner   *User   `gorm:"foreignKey:PartnerID" json:"partner,omitempty"`
}
