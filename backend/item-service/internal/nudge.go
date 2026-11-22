package internal

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/viettungvuong/emiumuagi-backend/database"
	"github.com/viettungvuong/emiumuagi-backend/models"
	"gorm.io/gorm"
)

// Nudges at an item's own times rather than in the digest, for whoever is to
// buy it (the owner's partner, or the owner when they have none): an hour before
// its deadline, and 5 minutes before and at its time to buy. Looked for every
// minute. (The digest adds "due today" on the deadline's day, see notify.go.)

const (
	deadlineNudgeBefore = time.Hour
	buyNudgeBefore      = 5 * time.Minute
	// "Time to buy!" still goes out this late (the service was down, say), the
	// nudges before a time only while that time is still ahead
	lateNudgeGrace = 30 * time.Minute
)

type nudgeKind int

const (
	deadlineSoon nudgeKind = iota
	buySoon
	buyNow
)

// StartNudgeJob looks for nudges due at the top of every minute
func StartNudgeJob() {
	go func() {
		time.Sleep(time.Until(time.Now().Truncate(time.Minute).Add(time.Minute)))
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			if err := SendNudges(context.Background(), time.Now()); err != nil {
				log.Printf("[nudge] %v", err)
			}
			<-ticker.C
		}
	}()
}

// An item not bought yet with a deadline or time to buy
type timedItem struct {
	ID         uint
	ItemName   string
	Owner      string
	DeadlineAt *time.Time
	BuyAt      *time.Time
	NudgesSent int
}

// nudgesDue is what to send about the item at `now`, and the Nudge* bits that
// are then done with, sent or not (one whose moment has passed is dropped)
func (i timedItem) nudgesDue(now time.Time) (send []nudgeKind, done int) {
	due := func(bit int, at *time.Time, before time.Duration) bool {
		return at != nil && i.NudgesSent&bit == 0 && !now.Before(at.Add(-before))
	}

	if due(models.NudgeDeadlineSoon, i.DeadlineAt, deadlineNudgeBefore) {
		done |= models.NudgeDeadlineSoon
		if now.Before(*i.DeadlineAt) {
			send = append(send, deadlineSoon)
		}
	}
	if due(models.NudgeBuySoon, i.BuyAt, buyNudgeBefore) {
		done |= models.NudgeBuySoon
		if now.Before(*i.BuyAt) {
			send = append(send, buySoon)
		}
	}
	if due(models.NudgeBuyNow, i.BuyAt, 0) {
		done |= models.NudgeBuyNow
		if now.Before(i.BuyAt.Add(lateNudgeGrace)) {
			send = append(send, buyNow)
		}
	}
	return send, done
}

// SendNudges sends the nudges due at `now`. One that doesn't go out (the user
// service or Expo didn't answer) is tried again the next minute.
func SendNudges(ctx context.Context, now time.Time) error {
	var items []timedItem
	err := database.DB.Model(&models.Item{}).
		Select("id, item_name, owner, deadline_at, buy_at, nudges_sent").
		Where(`deleted_at IS NULL AND NOT bought AND (
			(deadline_at IS NOT NULL AND nudges_sent & ? = 0 AND deadline_at <= ?) OR
			(buy_at IS NOT NULL AND nudges_sent & ? = 0 AND buy_at <= ?) OR
			(buy_at IS NOT NULL AND nudges_sent & ? = 0 AND buy_at <= ?))`,
			models.NudgeDeadlineSoon, now.Add(deadlineNudgeBefore),
			models.NudgeBuySoon, now.Add(buyNudgeBefore),
			models.NudgeBuyNow, now).
		Scan(&items).Error
	if err != nil {
		return fmt.Errorf("could not load items: %w", err)
	}
	if len(items) == 0 {
		return nil
	}

	buyers := map[string]string{} // owner → whoever is to buy their things
	var messages []PushMessage
	done := map[uint]int{} // item → bits to mark once its messages are out
	sending := map[uint]bool{}

	for _, item := range items {
		send, bits := item.nudgesDue(now)
		if len(send) == 0 {
			done[item.ID] = bits
			continue
		}

		buyer, ok := buyers[item.Owner]
		if !ok {
			partner, err := PartnerOfUser(ctx, item.Owner)
			if err != nil {
				log.Printf("[nudge] %s: could not look up their partner, trying next minute: %v", item.Owner, err)
				continue
			}
			buyer = item.Owner
			if partner != "" {
				buyer = partner
			}
			buyers[item.Owner] = buyer
		}

		var phones []models.PushToken
		if err := database.DB.Where("username = ?", buyer).Find(&phones).Error; err != nil {
			log.Printf("[nudge] item #%d: could not load %s's phones, trying next minute: %v", item.ID, buyer, err)
			continue
		}
		for _, kind := range send {
			for _, phone := range phones {
				title, body := renderNudge(kind, item, phone.Language)
				messages = append(messages, PushMessage{
					To: phone.Token, Title: title, Body: body,
					Sound: "default", ChannelID: PushChannel, Priority: "high",
				})
			}
		}
		done[item.ID] = bits
		sending[item.ID] = true
	}

	gone, sendErr := SendPush(ctx, messages)
	if len(gone) > 0 {
		database.DB.Where("token IN ?", gone).Delete(&models.PushToken{})
	}

	for id, bits := range done {
		if sendErr != nil && sending[id] {
			continue // tried again next minute
		}
		err := database.DB.Model(&models.Item{}).Where("id = ?", id).
			Update("nudges_sent", gorm.Expr("nudges_sent | ?", bits)).Error
		if err != nil {
			log.Printf("[nudge] item #%d: could not mark nudges as sent: %v", id, err)
		}
	}

	if sendErr != nil {
		return fmt.Errorf("could not send, trying next minute: %w", sendErr)
	}
	if len(messages) > 0 {
		log.Printf("[nudge] sent %d nudge(s) about %d item(s)", len(messages), len(sending))
	}
	return nil
}

type nudgeText struct{ title, body string }

// The item's name, then (for the first two) the time
var nudgeTexts = map[string]map[nudgeKind]nudgeText{
	"vi": {
		deadlineSoon: {"Sắp hết hạn mua nè ⏳", "⏳ %s: hạn chót %s"},
		buySoon:      {"Sắp tới giờ mua nè 🛒", "🛒 %s lúc %s"},
		buyNow:       {"Tới giờ mua rồi nè! 🛒", "🛒 %s"},
	},
	"en": {
		deadlineSoon: {"Deadline coming up ⏳", "⏳ %s: due at %s"},
		buySoon:      {"Time to buy soon 🛒", "🛒 %s at %s"},
		buyNow:       {"Time to buy! 🛒", "🛒 %s"},
	},
}

func renderNudge(kind nudgeKind, item timedItem, lang string) (title, body string) {
	text := nudgeTexts[DigestLanguage(lang)][kind]
	name := shorten(item.ItemName)
	switch kind {
	case deadlineSoon:
		return text.title, fmt.Sprintf(text.body, name, item.DeadlineAt.In(jobLocation()).Format("15:04"))
	case buySoon:
		return text.title, fmt.Sprintf(text.body, name, item.BuyAt.In(jobLocation()).Format("15:04"))
	}
	return text.title, fmt.Sprintf(text.body, name)
}
