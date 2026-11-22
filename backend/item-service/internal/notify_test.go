package internal

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/viettungvuong/emiumuagi-backend/models"
)

func vn(day, hour, min int) time.Time {
	return time.Date(2026, 11, day, hour, min, 0, 0, jobLocation())
}

func TestNextRunAt(t *testing.T) {
	hours := []int{0, 9, 17}
	cases := []struct{ now, want time.Time }{
		{vn(18, 8, 59), vn(18, 9, 0)},
		{vn(18, 9, 0), vn(18, 17, 0)}, // a run that is due now is not the next one
		{vn(18, 17, 30), vn(19, 0, 0)},
		{vn(18, 0, 0), vn(18, 9, 0)},
	}
	for _, c := range cases {
		if got := nextRunAt(c.now, hours); !got.Equal(c.want) {
			t.Errorf("nextRunAt(%s) = %s, want %s", c.now, got, c.want)
		}
	}
}

func TestStageDue(t *testing.T) {
	at := vn(18, 9, 0)
	cases := []struct {
		age   time.Duration
		stage int
		want  int
	}{
		{time.Hour, models.NotifyNew, models.NotifyAnnounced},
		{time.Hour, models.NotifyAnnounced, models.NotifyAnnounced}, // nothing new
		{3*24*time.Hour + time.Minute, models.NotifyAnnounced, models.NotifyRemindedDays},
		{3*24*time.Hour + time.Minute, models.NotifyNew, models.NotifyRemindedDays}, // straight to the reminder
		{5 * 24 * time.Hour, models.NotifyRemindedDays, models.NotifyRemindedDays},
		{7 * 24 * time.Hour, models.NotifyRemindedDays, models.NotifyDone},
	}
	for _, c := range cases {
		item := dueItem{CreatedAt: at.Add(-c.age), NotifyStage: c.stage}
		if got := item.stageDue(at); got != c.want {
			t.Errorf("age %s, stage %d: got %d, want %d", c.age, c.stage, got, c.want)
		}
	}
}

func TestDigest(t *testing.T) {
	at := vn(18, 17, 0)
	items := []dueItem{
		{ItemName: "Áo khoác", Owner: "em", due: models.NotifyAnnounced},
		{ItemName: "Trà sữa", Owner: "em", due: models.NotifyRemindedDays},
		{ItemName: "Giày", Owner: "em", due: models.NotifyDone},
		{ItemName: "Tai nghe", Owner: "anh", due: models.NotifyAnnounced},
		{ItemName: "Sách", Owner: "solo", due: models.NotifyAnnounced},
		{ItemName: "Bút", Owner: "solo", due: models.NotifyRemindedDays},
	}
	dates := []upcomingDate{
		{ScheduledAt: vn(18, 19, 0), Username: "em", RestaurantName: "Sushi"},
		{ScheduledAt: vn(19, 8, 30), Username: "anh", RestaurantName: "Phở"},
		{ScheduledAt: vn(18, 20, 0), Username: "solo", RestaurantName: "Bún"},
	}

	// anh is to buy what em added, and sees both their dates
	title, body := buildDigest("anh", "em", items, dates, nil, at).render("vi")
	want := "📅 Hôm nay 19:00 · Sushi\n📅 Ngày mai 08:30 · Phở\n🛍️ em vừa thêm: Áo khoác\n⏰ Vẫn chưa mua: Trà sữa (3 ngày rồi), Giày (1 tuần rồi)"
	if title != digestTexts["vi"].mixedTitle || body != want {
		t.Errorf("anh got %q / %q", title, body)
	}

	// em hears about what anh added, and nothing about her own items
	_, body = buildDigest("em", "anh", items, nil, nil, at).render("en")
	if body != "🛍️ anh added: Tai nghe" {
		t.Errorf("em got %q", body)
	}

	// On their own: reminded about their own items, never told they added one
	title, body = buildDigest("solo", "", items, nil, nil, at).render("en")
	if title != digestTexts["en"].remindTitle || body != "⏰ Still not bought: Bút (3 days)" {
		t.Errorf("solo got %q / %q", title, body)
	}

	if !buildDigest("other", "", items, dates, nil, at).empty() {
		t.Error("someone outside both couples got news")
	}
}

func TestListNames(t *testing.T) {
	if got := listNames([]string{"a", "b", "c", "d", "e"}); got != "a, b, c +2" {
		t.Errorf("got %q", got)
	}
	long := strings.Repeat("ă", 60)
	if got := shorten(long); len([]rune(got)) != maxNameRunes || !strings.HasSuffix(got, "…") {
		t.Errorf("shorten gave %q", got)
	}
}

func TestNudgesDue(t *testing.T) {
	at := func(d time.Time) *time.Time { return &d }
	deadline, buy := vn(18, 18, 0), vn(18, 12, 0)
	item := timedItem{DeadlineAt: at(deadline), BuyAt: at(buy)}
	cases := []struct {
		now  time.Time
		sent int
		want []nudgeKind
		done int
	}{
		{vn(18, 11, 54), 0, nil, 0},
		{vn(18, 11, 55), 0, []nudgeKind{buySoon}, models.NudgeBuySoon},
		{vn(18, 12, 0), models.NudgeBuySoon, []nudgeKind{buyNow}, models.NudgeBuyNow},
		// Missed the 5-minute one: only "time to buy", the other is dropped
		{vn(18, 12, 10), 0, []nudgeKind{buyNow}, models.NudgeBuySoon | models.NudgeBuyNow},
		// Far too late for "time to buy"
		{vn(18, 13, 0), models.NudgeBuySoon, nil, models.NudgeBuyNow},
		{vn(18, 17, 0), models.NudgeBuySoon | models.NudgeBuyNow, []nudgeKind{deadlineSoon}, models.NudgeDeadlineSoon},
		{vn(18, 18, 0), models.NudgeBuySoon | models.NudgeBuyNow, nil, models.NudgeDeadlineSoon},
	}
	for _, c := range cases {
		item.NudgesSent = c.sent
		send, done := item.nudgesDue(c.now)
		if fmt.Sprint(send) != fmt.Sprint(c.want) || done != c.done {
			t.Errorf("at %s with %b sent: got %v / %b, want %v / %b", c.now.Format("15:04"), c.sent, send, done, c.want, c.done)
		}
	}

	_, body := renderNudge(deadlineSoon, item, "vi")
	if body != "⏳ : hạn chót 18:00" {
		t.Errorf("deadline nudge %q", body)
	}
}

func TestDueTodayInDigest(t *testing.T) {
	at := vn(18, 0, 0)
	deadlines := []dueToday{
		{ItemName: "Áo", Owner: "em", DeadlineAt: vn(18, 18, 0)},
		{ItemName: "Bút", Owner: "anh", DeadlineAt: vn(18, 20, 0)},
	}
	title, body := buildDigest("anh", "em", nil, nil, deadlines, at).render("en")
	if title != digestTexts["en"].dueTitle || body != "📌 Due today: Áo (18:00)" {
		t.Errorf("anh got %q / %q", title, body)
	}
}
