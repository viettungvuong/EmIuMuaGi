package internal

import (
	"time"
	_ "time/tzdata" // so Vietnam time works on a server without a zoneinfo database
)

// Both daily jobs (purge, notify) keep Vietnam time, where the couples live
const jobTimeZone = "Asia/Ho_Chi_Minh"

func jobLocation() *time.Location {
	loc, err := time.LoadLocation(jobTimeZone)
	if err != nil {
		return time.UTC
	}
	return loc
}

// nextRunAt is the first of the given hours (0-23) to come round after now, in
// Vietnam time
func nextRunAt(now time.Time, hours []int) time.Time {
	loc := jobLocation()
	now = now.In(loc)

	var next time.Time
	for _, h := range hours {
		at := time.Date(now.Year(), now.Month(), now.Day(), h, 0, 0, 0, loc)
		if !at.After(now) {
			at = at.AddDate(0, 0, 1)
		}
		if next.IsZero() || at.Before(next) {
			next = at
		}
	}
	return next
}
