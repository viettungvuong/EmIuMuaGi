package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/viettungvuong/emiumuagi-backend/database"
	"github.com/viettungvuong/emiumuagi-backend/models"
)

const NTFY_TOPIC = "emiumuagi_tung"

func sendPushNotification(title string, message string) {
	go func() {
		url := "https://ntfy.sh/" + NTFY_TOPIC
		req, err := http.NewRequest("POST", url, bytes.NewBuffer([]byte(message)))
		if err != nil {
			log.Println("Failed to create request:", err)
			return
		}
		req.Header.Set("Title", title)
		req.Header.Set("Tags", "shopping_bags,heart")

		client := &http.Client{Timeout: 3 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			log.Println("Failed to send notification:", err)
			return
		}
		log.Println("Notification sent about new item added")
		defer resp.Body.Close()
	}()
}

func GetItems(c *gin.Context) {
	type PolledItem struct {
		models.Item
		CSize    *string `gorm:"column:c_size"`
		Color    *string `gorm:"column:color"`
		Brand    *string `gorm:"column:brand"`
		Sugar    *string `gorm:"column:sugar"`
		FSize    *string `gorm:"column:f_size"`
		FNotes   *string `gorm:"column:f_notes"`
		Toppings *string `gorm:"column:toppings"`
		Category *string `gorm:"column:category"`
		ONotes   *string `gorm:"column:o_notes"`
	}

	var results []PolledItem

	err := database.DB.Raw(`
		SELECT i.id, i.item_name, i.quantity, i.buy_url, i.shop_name, i.created_at, i.item_type, i.bought,
			c.size as c_size, c.color, c.brand,
			f.sugar, f.size as f_size, f.notes as f_notes, f.toppings,
			o.category, o.notes as o_notes
		FROM items i
		LEFT JOIN clothes c ON i.id = c.id
		LEFT JOIN food_and_drinks f ON i.id = f.id
		LEFT JOIN others o ON i.id = o.id
		ORDER BY i.created_at DESC
	`).Scan(&results).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve items"})
		return
	}

	responses := make([]models.AnyItemResponse, 0, len(results))
	for _, res := range results {
		resp := models.AnyItemResponse{Item: res.Item}
		if res.ItemType == "clothes" {
			resp.Size = res.CSize
			resp.Color = res.Color
			resp.Brand = res.Brand
		} else if res.ItemType == "food_and_drink" {
			resp.Sugar = res.Sugar
			resp.Size = res.FSize
			resp.Notes = res.FNotes
			if res.Toppings != nil && *res.Toppings != "" && *res.Toppings != "null" {
				var t []string
				if json.Unmarshal([]byte(*res.Toppings), &t) == nil {
					resp.Toppings = t
				}
			}
		} else if res.ItemType == "others" {
			resp.Category = res.Category
			resp.Notes = res.ONotes
		}
		responses = append(responses, resp)
	}

	c.JSON(http.StatusOK, responses)
}

func CreateItem(c *gin.Context) {
	var input models.AnyItemResponse
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if input.Quantity == 0 {
		input.Quantity = 1
	}

	tx := database.DB.Begin()

	item := input.Item
	if err := tx.Create(&item).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create base item"})
		return
	}

	if item.ItemType == "clothes" {
		cItem := models.Clothes{ID: item.ID, Size: input.Size, Color: input.Color, Brand: input.Brand}
		if err := tx.Create(&cItem).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create clothes item"})
			return
		}
	} else if item.ItemType == "food_and_drink" {
		fItem := models.FoodAndDrink{ID: item.ID, Sugar: input.Sugar, Size: input.Size, Notes: input.Notes, Toppings: input.Toppings}
		if err := tx.Create(&fItem).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create food_and_drink item"})
			return
		}
	} else if item.ItemType == "others" {
		oItem := models.Others{ID: item.ID, Category: input.Category, Notes: input.Notes}
		if err := tx.Create(&oItem).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create others item"})
			return
		}
	}

	tx.Commit()

	input.Item = item
	sendPushNotification("Mới mún mua thêm đồ nè! 🛍️", "Vừa thêm vào danh sách: "+item.ItemName)
	log.Printf("Added new item %s\n", item.ItemName)
	c.JSON(http.StatusCreated, input)
}

func DeleteItem(c *gin.Context) {
	id := c.Param("item_id")
	var item models.Item

	if err := database.DB.First(&item, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Item not found"})
		return
	}

	tx := database.DB.Begin()

	switch item.ItemType {
	case "clothes":
		tx.Delete(&models.Clothes{}, id)
	case "food_and_drink":
		tx.Delete(&models.FoodAndDrink{}, id)
	case "others":
		tx.Delete(&models.Others{}, id)
	}

	tx.Delete(&models.Item{}, id)
	tx.Commit()

	log.Printf("Deleted %s\n", item.ItemName)

	c.Status(http.StatusNoContent)
}

func addHistory(ctx context.Context, item_id uint) uuid.UUID {
	h := models.History{
		ItemID: item_id,
		Time:   time.Now(),
	}

	// Store on db
	result := database.DB.WithContext(ctx).Create(&h)

	if result.Error != nil {
		return uuid.Nil
	}

	return h.ID
}

func MarkItemAsBought(c *gin.Context) {
	id := c.Param("item_id")
	var item models.Item

	if err := database.DB.First(&item, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Item not found"})
		return
	}

	item.Bought = true
	database.DB.Save(&item)

	// Automatically create a history entry
	historyId := addHistory(c.Request.Context(), item.ID)

	var res struct {
		models.Item
		CSize    *string `gorm:"column:c_size"`
		Color    *string `gorm:"column:color"`
		Brand    *string `gorm:"column:brand"`
		Sugar    *string `gorm:"column:sugar"`
		FSize    *string `gorm:"column:f_size"`
		FNotes   *string `gorm:"column:f_notes"`
		Toppings *string `gorm:"column:toppings"`
		Category *string `gorm:"column:category"`
		ONotes   *string `gorm:"column:o_notes"`
	}

	database.DB.Raw(`
		SELECT i.id, i.item_name, i.quantity, i.buy_url, i.shop_name, i.created_at, i.item_type, i.bought,
			c.size as c_size, c.color, c.brand,
			f.sugar, f.size as f_size, f.notes as f_notes, f.toppings,
			o.category, o.notes as o_notes
		FROM items i
		LEFT JOIN clothes c ON i.id = c.id
		LEFT JOIN food_and_drinks f ON i.id = f.id
		LEFT JOIN others o ON i.id = o.id
		WHERE i.id = ?
	`, id).Scan(&res)

	resp := models.AnyItemResponse{Item: res.Item, Additional: map[string]any{
		"HistoryID": historyId,
	}}

	switch res.ItemType {
	case "clothes":
		resp.Size = res.CSize
		resp.Color = res.Color
		resp.Brand = res.Brand
	case "food_and_drink":
		resp.Sugar = res.Sugar
		resp.Size = res.FSize
		resp.Notes = res.FNotes
		if res.Toppings != nil && *res.Toppings != "" && *res.Toppings != "null" {
			var t []string
			if json.Unmarshal([]byte(*res.Toppings), &t) == nil {
				resp.Toppings = t
			}
		}
	case "others":
		resp.Category = res.Category
		resp.Notes = res.ONotes
	}

	c.JSON(http.StatusOK, resp)
}

func AddReview(c *gin.Context) {
	id := c.Param("item_id")
	var item models.Item

	if err := database.DB.First(&item, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Item not found"})
		return
	}

	var reqBody struct {
		Score   int    `json:"score" binding:"required"`
		Content string `json:"content"`
	}

	if err := c.ShouldBindJSON(&reqBody); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find the latest History for this item
	var history models.History
	if err := database.DB.Where("item_id = ?", item.ID).Order("time desc").First(&history).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "History not found for this item, cannot add review"})
		return
	}

	// Create Review
	review := models.Review{
		HistoryID: history.ID,
		Score:     reqBody.Score,
		Content:   reqBody.Content,
	}

	if err := database.DB.Create(&review).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create review"})
		return
	}

	c.JSON(http.StatusCreated, review)
}
