package models

import (
	"time"
)

type Item struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	ItemName  string    `gorm:"size:255;not null" json:"item_name"`
	Quantity  int       `gorm:"default:1;not null" json:"quantity"`
	BuyURL    *string   `gorm:"size:2048" json:"buy_url"`
	ShopName  *string   `gorm:"size:255" json:"shop_name"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	ItemType  string    `gorm:"size:50;not null" json:"item_type"`
	Bought    bool      `gorm:"default:false;not null" json:"bought"`
}

type Clothes struct {
	ID    uint    `gorm:"primaryKey" json:"id"`
	Size  *string `gorm:"size:20" json:"size"`
	Color *string `gorm:"size:50" json:"color"`
	Brand *string `gorm:"size:100" json:"brand"`
}

type FoodAndDrink struct {
	ID       uint     `gorm:"primaryKey" json:"id"`
	Sugar    *string  `gorm:"size:100" json:"sugar"`
	Size     *string  `gorm:"size:20" json:"size"`
	Notes    *string  `gorm:"size:500" json:"notes"`
	Toppings []string `gorm:"serializer:json" json:"toppings"`
}

type Others struct {
	ID       uint    `gorm:"primaryKey" json:"id"`
	Category *string `gorm:"size:100" json:"category"`
	Notes    *string `gorm:"size:500" json:"notes"`
}

// AnyItemResponse is used to serialize and deserialize the mixed responses, similar to Python's Pydantic AnyItemResponse union.
type AnyItemResponse struct {
	Item
	Size     *string  `json:"size,omitempty"`
	Color    *string  `json:"color,omitempty"`
	Brand    *string  `json:"brand,omitempty"`
	Sugar    *string  `json:"sugar,omitempty"`
	Notes    *string  `json:"notes,omitempty"`
	Toppings []string `json:"toppings,omitempty"`
	Category *string  `json:"category,omitempty"`
}
