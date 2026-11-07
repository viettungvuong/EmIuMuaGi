package handlers

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/viettungvuong/emiumuagi-backend/database"
	"github.com/viettungvuong/emiumuagi-backend/internal"
	"github.com/viettungvuong/emiumuagi-backend/models"
)

// One date on the calendar, with what the popup shows about the restaurant
type scheduleEntry struct {
	ID             uint      `json:"id"`
	ScheduledAt    time.Time `json:"scheduled_at"`
	RestaurantID   uint      `json:"restaurant_id"`
	RestaurantName string    `json:"restaurant_name"`
	Address        *string   `json:"address"`
	MainFood       *string   `json:"main_food"`
	Username       string    `json:"username"`
}

// How far in the past a new date may be, so a slow clock on the phone still
// lets someone book "now"
const scheduleGrace = 5 * time.Minute

// GetSchedules lists every date booked by the caller or their partner, oldest first
func GetSchedules(c *gin.Context) {
	owners, err := internal.OwnerScope(c)
	if err != nil {
		log.Printf("[schedule] could not resolve partner, showing own dates only: %v", err)
	}

	entries := []scheduleEntry{}
	err = database.DB.Raw(`
		SELECT s.id, s.scheduled_at, s.restaurant_id, i.item_name AS restaurant_name,
			r.address, r.main_food, s.username
		FROM schedules s
		JOIN restaurants r ON r.id = s.restaurant_id
		JOIN items i ON i.id = s.restaurant_id
		WHERE s.username IN ? AND i.deleted_at IS NULL
		ORDER BY s.scheduled_at
	`, owners).Scan(&entries).Error
	if err != nil {
		log.Printf("[schedule] list for %v: %v", owners, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve schedules"})
		return
	}

	log.Printf("[schedule] listed %d dates for %v", len(entries), owners)
	c.JSON(http.StatusOK, entries)
}

// CreateSchedule books a date at a restaurant on the caller's or their partner's list
func CreateSchedule(c *gin.Context) {
	username := c.GetString("username")

	var input struct {
		RestaurantID uint      `json:"restaurant_id" binding:"required"`
		ScheduledAt  time.Time `json:"scheduled_at" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		log.Printf("[schedule] create by %s: invalid request: %v", username, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	item, ok := loadItemInScope(c, input.RestaurantID)
	if !ok {
		return
	}
	if item.ItemType != "restaurant" {
		log.Printf("[schedule] create by %s: item #%d is %s, not a restaurant", username, item.ID, item.ItemType)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only restaurants can be scheduled"})
		return
	}
	if input.ScheduledAt.Before(time.Now().Add(-scheduleGrace)) {
		log.Printf("[schedule] create by %s: %s has already passed", username, input.ScheduledAt.Format(time.RFC3339))
		c.JSON(http.StatusBadRequest, gin.H{"error": "That time has already passed"})
		return
	}

	schedule := models.Schedule{ScheduledAt: input.ScheduledAt, RestaurantID: item.ID, Username: username}
	if err := database.DB.Create(&schedule).Error; err != nil {
		log.Printf("[schedule] create %q at %s by %s: %v", item.ItemName, input.ScheduledAt.Format(time.RFC3339), username, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save the schedule"})
		return
	}

	var restaurant models.Restaurant
	if err := database.DB.First(&restaurant, item.ID).Error; err != nil {
		log.Printf("[schedule] #%d: could not load restaurant #%d details: %v", schedule.ID, item.ID, err)
	}

	log.Printf("[schedule] #%d: %s booked %q for %s", schedule.ID, username, item.ItemName, schedule.ScheduledAt.Format(time.RFC3339))
	c.JSON(http.StatusCreated, scheduleEntry{
		ID:             schedule.ID,
		ScheduledAt:    schedule.ScheduledAt,
		RestaurantID:   item.ID,
		RestaurantName: item.ItemName,
		Address:        restaurant.Address,
		MainFood:       restaurant.MainFood,
		Username:       username,
	})
}

// DeleteSchedule cancels a date; only whoever booked it can
func DeleteSchedule(c *gin.Context) {
	id := c.Param("schedule_id")
	username := c.GetString("username")

	var schedule models.Schedule
	if err := database.DB.First(&schedule, "id = ?", id).Error; err != nil {
		log.Printf("[schedule] cancel #%s by %s: not found (%v)", id, username, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Schedule not found"})
		return
	}
	if schedule.Username != username {
		log.Printf("[schedule] cancel #%s by %s: refused, %s booked it", id, username, schedule.Username)
		c.JSON(http.StatusForbidden, gin.H{"error": "Only whoever booked this date can cancel it"})
		return
	}

	if err := database.DB.Delete(&schedule).Error; err != nil {
		log.Printf("[schedule] cancel #%s by %s: %v", id, username, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel the schedule"})
		return
	}

	log.Printf("[schedule] #%d: cancelled by %s", schedule.ID, username)
	c.Status(http.StatusNoContent)
}
