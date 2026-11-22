package internal

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/viettungvuong/emiumuagi-backend/database"
	"github.com/viettungvuong/emiumuagi-backend/models"
)

// The digest: at 0:00, 9:00 and 17:00 Vietnam time (NOTIFY_HOURS overrides,
// e.g. "8,20"), each phone with the app gets one notification rolling up
//   - the dates on the couple's calendar before the run after next, so each date
//     comes up twice: in the two runs before it
//   - what their partner added since the last run
//   - what is still not bought 3 days and a week after it was added, for whoever
//     is to buy it: the owner's partner, or the owner when they have none
//   - in the day's first run, what is due today (its deadline), for the same
//     person; the nudges at an item's own times are nudge.go's
// Items keep how far they have got (items.notify_stage), so news isn't sent
// twice, and what came in while the service was down goes out with the next run.

var defaultNotifyHours = []int{0, 9, 17}

const (
	firstReminderAge  = 3 * 24 * time.Hour
	secondReminderAge = 7 * 24 * time.Hour

	maxListed    = 3  // names on a line before the rest become "+N"
	maxNameRunes = 40 // longer names are cut short with "…"
)

// StartNotifyJob sends the digest at each notify hour. Unlike the purge it does
// not also run on start, which would ping everyone on every restart.
func StartNotifyJob() {
	hours := notifyHours()
	go func() {
		next := nextRunAt(time.Now(), hours)
		for {
			log.Printf("[notify] next digest at %s", next.Format(time.RFC1123))
			time.Sleep(time.Until(next))

			// The later of the two, so a clock set back a little can't repeat this run
			at := laterOf(time.Now(), next)
			if err := SendDigests(context.Background(), at, hours); err != nil {
				log.Printf("[notify] digest failed: %v", err)
			}
			next = nextRunAt(at, hours)
		}
	}()
}

// An item not bought yet that may have news in this digest
type dueItem struct {
	ID          uint
	ItemName    string
	Owner       string
	CreatedAt   time.Time
	NotifyStage int
	due         int // the notify_stage it moves to in this run
}

// stageDue is where an item stands at `at`: announced once added, reminded about
// 3 days on, and again a week on. A stage it has already passed stays passed.
func (i dueItem) stageDue(at time.Time) int {
	age := at.Sub(i.CreatedAt)
	switch {
	case age >= secondReminderAge:
		return models.NotifyDone
	case age >= firstReminderAge:
		return max(i.NotifyStage, models.NotifyRemindedDays)
	default:
		return max(i.NotifyStage, models.NotifyAnnounced)
	}
}

// An item not bought yet whose deadline is later today
type dueToday struct {
	ItemName   string
	Owner      string
	DeadlineAt time.Time
}

type upcomingDate struct {
	ScheduledAt    time.Time
	Username       string // who booked it
	RestaurantName string
}

// SendDigests sends this run's digest to every phone that has something in it
func SendDigests(ctx context.Context, at time.Time, hours []int) error {
	items, err := loadDueItems(at)
	if err != nil {
		return fmt.Errorf("could not load items: %w", err)
	}
	dates, err := loadUpcomingDates(at, nextRunAt(nextRunAt(at, hours), hours))
	if err != nil {
		return fmt.Errorf("could not load dates: %w", err)
	}
	deadlines, err := loadDueToday(at, hours)
	if err != nil {
		return fmt.Errorf("could not load deadlines: %w", err)
	}

	var tokens []models.PushToken
	if err := database.DB.Find(&tokens).Error; err != nil {
		return fmt.Errorf("could not load push tokens: %w", err)
	}
	phones := map[string][]models.PushToken{}
	for _, t := range tokens {
		phones[t.Username] = append(phones[t.Username], t)
	}

	var messages []PushMessage
	people, lookupsFailed := 0, 0
	for username, theirPhones := range phones {
		partner, err := PartnerOfUser(ctx, username)
		if err != nil {
			log.Printf("[notify] %s: could not look up their partner, skipped: %v", username, err)
			lookupsFailed++
			continue
		}

		d := buildDigest(username, partner, items, dates, deadlines, at)
		if d.empty() {
			continue
		}
		people++
		for _, phone := range theirPhones {
			title, body := d.render(phone.Language)
			messages = append(messages, PushMessage{
				To:        phone.Token,
				Title:     title,
				Body:      body,
				Sound:     "default",
				ChannelID: PushChannel,
				Priority:  "high",
			})
		}
	}

	// With the user service down nobody could be told anything: leave the items
	// for the next run
	if lookupsFailed > 0 && lookupsFailed == len(phones) {
		return errors.New("no partner lookup worked, items left for the next run")
	}

	gone, err := SendPush(ctx, messages)
	if len(gone) > 0 {
		if err := database.DB.Where("token IN ?", gone).Delete(&models.PushToken{}).Error; err != nil {
			log.Printf("[notify] could not forget %d phone(s) the app is gone from: %v", len(gone), err)
		} else {
			log.Printf("[notify] forgot %d phone(s) the app is gone from", len(gone))
		}
	}
	if err != nil {
		return fmt.Errorf("could not send everything, items left for the next run: %w", err)
	}

	// Their turn has passed, whether or not anyone had a phone to be told on
	if err := markNotified(items); err != nil {
		return fmt.Errorf("could not mark items as notified: %w", err)
	}

	log.Printf("[notify] sent %d notification(s) to %d people: %d date(s), %d item(s) with news",
		len(messages), people, len(dates), len(items))
	return nil
}

// loadDueItems lists the items not bought or deleted that have news at `at`
func loadDueItems(at time.Time) ([]dueItem, error) {
	var rows []dueItem
	err := database.DB.Model(&models.Item{}).
		Select("id, item_name, owner, created_at, notify_stage").
		Where("deleted_at IS NULL AND NOT bought AND notify_stage < ?", models.NotifyDone).
		Order("created_at, id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	due := rows[:0]
	for _, row := range rows {
		if row.due = row.stageDue(at); row.due > row.NotifyStage {
			due = append(due, row)
		}
	}
	return due, nil
}

// loadUpcomingDates lists the dates booked from `from` until `until`, soonest first
func loadUpcomingDates(from, until time.Time) ([]upcomingDate, error) {
	var dates []upcomingDate
	err := database.DB.Raw(`
		SELECT s.scheduled_at, s.username, i.item_name AS restaurant_name
		FROM schedules s
		JOIN items i ON i.id = s.restaurant_id
		WHERE s.scheduled_at >= ? AND s.scheduled_at < ? AND i.deleted_at IS NULL
		ORDER BY s.scheduled_at
	`, from, until).Scan(&dates).Error
	return dates, err
}

// loadDueToday lists, in the day's first run only, the items not bought whose
// deadline is still to come today
func loadDueToday(at time.Time, hours []int) ([]dueToday, error) {
	loc := jobLocation()
	local := at.In(loc)
	dayStart := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, loc)
	first := nextRunAt(dayStart.Add(-time.Nanosecond), hours)
	if at.Before(first) || !at.Before(nextRunAt(first, hours)) {
		return nil, nil
	}

	var due []dueToday
	err := database.DB.Model(&models.Item{}).
		Select("item_name, owner, deadline_at").
		Where("deleted_at IS NULL AND NOT bought AND deadline_at >= ? AND deadline_at < ?", at, dayStart.AddDate(0, 0, 1)).
		Order("deadline_at").
		Scan(&due).Error
	return due, err
}

// markNotified moves each item on to the stage this run took it to
func markNotified(items []dueItem) error {
	byStage := map[int][]uint{}
	for _, item := range items {
		byStage[item.due] = append(byStage[item.due], item.ID)
	}
	for stage, ids := range byStage {
		err := database.DB.Model(&models.Item{}).
			Where("id IN ? AND notify_stage < ?", ids, stage).
			Update("notify_stage", stage).Error
		if err != nil {
			return err
		}
	}
	return nil
}

type reminder struct {
	name string
	week bool // a week since it was added, rather than 3 days
}

// What one person's notification says
type digest struct {
	at        time.Time
	partner   string
	dates     []upcomingDate
	added     []string // what the partner added
	reminders []reminder
	dueToday  []dueToday
}

func buildDigest(me, partner string, items []dueItem, dates []upcomingDate, deadlines []dueToday, at time.Time) digest {
	d := digest{at: at, partner: partner}

	// Both of the couple's dates, as on the calendar (handlers.GetSchedules)
	for _, date := range dates {
		if date.Username == me || (partner != "" && date.Username == partner) {
			d.dates = append(d.dates, date)
		}
	}

	// Only whoever is to buy it hears about it
	toBuy := func(owner string) bool {
		return (partner != "" && owner == partner) || (partner == "" && owner == me)
	}

	for _, item := range deadlines {
		if toBuy(item.Owner) {
			d.dueToday = append(d.dueToday, item)
		}
	}

	for _, item := range items {
		if !toBuy(item.Owner) {
			continue
		}
		switch item.due {
		case models.NotifyAnnounced:
			if partner != "" { // no news to whoever added it themselves
				d.added = append(d.added, item.ItemName)
			}
		case models.NotifyRemindedDays:
			d.reminders = append(d.reminders, reminder{name: item.ItemName})
		case models.NotifyDone:
			d.reminders = append(d.reminders, reminder{name: item.ItemName, week: true})
		}
	}
	return d
}

func (d digest) empty() bool {
	return len(d.dates)+len(d.added)+len(d.reminders)+len(d.dueToday) == 0
}

// Backend text, like the OTP email's, rather than locales/*.json: the phone may
// be asleep when it arrives, with no app running to translate it
type digestText struct {
	datesTitle, addedTitle, remindTitle, dueTitle, mixedTitle string
	today, tomorrow                                           string
	added                                                     string // the partner, then the items
	notBought                                                 string // the items
	due                                                       string // the items, each with its time
	days, week                                                string // how long a reminded item has waited
}

var digestTexts = map[string]digestText{
	"vi": {
		datesTitle:  "Sắp tới có hẹn nè 💕",
		addedTitle:  "Mới mún mua thêm đồ nè! 🛍️",
		remindTitle: "Vẫn chưa mua nè ⏰",
		dueTitle:    "Hôm nay là hạn chót nè 📌",
		mixedTitle:  "Có tin mới nè 💕",
		today:       "Hôm nay",
		tomorrow:    "Ngày mai",
		added:       "🛍️ %s vừa thêm: %s",
		notBought:   "⏰ Vẫn chưa mua: %s",
		due:         "📌 Hạn chót hôm nay: %s",
		days:        "3 ngày rồi",
		week:        "1 tuần rồi",
	},
	"en": {
		datesTitle:  "Date coming up 💕",
		addedTitle:  "New things to buy! 🛍️",
		remindTitle: "Still not bought ⏰",
		dueTitle:    "Due today 📌",
		mixedTitle:  "What's new 💕",
		today:       "Today",
		tomorrow:    "Tomorrow",
		added:       "🛍️ %s added: %s",
		notBought:   "⏰ Still not bought: %s",
		due:         "📌 Due today: %s",
		days:        "3 days",
		week:        "1 week",
	},
}

// DigestLanguage is lang when the digest is written in it, else Vietnamese
func DigestLanguage(lang string) string {
	if _, ok := digestTexts[lang]; ok {
		return lang
	}
	return "vi"
}

// render writes the notification: one line per date, then what's due today,
// what was added and what's still not bought. The title says which, or that there's a mix.
func (d digest) render(lang string) (title, body string) {
	text := digestTexts[DigestLanguage(lang)]
	loc := jobLocation()
	var titles, lines []string

	if len(d.dates) > 0 {
		titles = append(titles, text.datesTitle)
		for i, date := range d.dates {
			if i == maxListed {
				lines = append(lines, fmt.Sprintf("📅 +%d", len(d.dates)-maxListed))
				break
			}
			when := date.ScheduledAt.In(loc)
			lines = append(lines, fmt.Sprintf("📅 %s %s · %s", text.day(when, d.at.In(loc)), when.Format("15:04"), shorten(date.RestaurantName)))
		}
	}

	if len(d.dueToday) > 0 {
		titles = append(titles, text.dueTitle)
		names := make([]string, len(d.dueToday))
		for i, item := range d.dueToday {
			names[i] = fmt.Sprintf("%s (%s)", shorten(item.ItemName), item.DeadlineAt.In(loc).Format("15:04"))
		}
		lines = append(lines, fmt.Sprintf(text.due, listNames(names)))
	}

	if len(d.added) > 0 {
		titles = append(titles, text.addedTitle)
		names := make([]string, len(d.added))
		for i, name := range d.added {
			names[i] = shorten(name)
		}
		lines = append(lines, fmt.Sprintf(text.added, d.partner, listNames(names)))
	}

	if len(d.reminders) > 0 {
		titles = append(titles, text.remindTitle)
		names := make([]string, len(d.reminders))
		for i, r := range d.reminders {
			waited := text.days
			if r.week {
				waited = text.week
			}
			names[i] = fmt.Sprintf("%s (%s)", shorten(r.name), waited)
		}
		lines = append(lines, fmt.Sprintf(text.notBought, listNames(names)))
	}

	title = text.mixedTitle
	if len(titles) == 1 {
		title = titles[0]
	}
	return title, strings.Join(lines, "\n")
}

// day names the day of `when` as seen on `now`'s: today, tomorrow or its date
func (t digestText) day(when, now time.Time) string {
	y, m, dd := now.Date()
	switch {
	case sameDay(when, now):
		return t.today
	case sameDay(when, time.Date(y, m, dd+1, 12, 0, 0, 0, now.Location())):
		return t.tomorrow
	}
	return when.Format("02/01")
}

func sameDay(a, b time.Time) bool {
	ay, am, ad := a.Date()
	by, bm, bd := b.Date()
	return ay == by && am == bm && ad == bd
}

func listNames(names []string) string {
	if len(names) <= maxListed {
		return strings.Join(names, ", ")
	}
	return fmt.Sprintf("%s +%d", strings.Join(names[:maxListed], ", "), len(names)-maxListed)
}

func shorten(name string) string {
	name = strings.TrimSpace(name)
	if utf8.RuneCountInString(name) <= maxNameRunes {
		return name
	}
	return strings.TrimSpace(string([]rune(name)[:maxNameRunes-1])) + "…"
}

func laterOf(a, b time.Time) time.Time {
	if a.After(b) {
		return a
	}
	return b
}

func notifyHours() []int {
	raw := strings.TrimSpace(os.Getenv("NOTIFY_HOURS"))
	if raw == "" {
		return defaultNotifyHours
	}

	var hours []int
	for _, part := range strings.Split(raw, ",") {
		h, err := strconv.Atoi(strings.TrimSpace(part))
		if err != nil || h < 0 || h > 23 {
			log.Printf("[notify] NOTIFY_HOURS=%q is not a list of hours 0-23, using %v", raw, defaultNotifyHours)
			return defaultNotifyHours
		}
		hours = append(hours, h)
	}
	return hours
}
