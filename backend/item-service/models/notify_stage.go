package models

// NotifyStage is the lookup table behind items.notify_stage, so the numbers
// read as names in the database too. Its rows are NotifyStages, kept in step
// with the Notify* constants by database.InitDB.
type NotifyStage struct {
	ID          int16  `gorm:"primaryKey;autoIncrement:false"`
	Name        string `gorm:"size:32;not null;unique"`
	Description string `gorm:"size:255;not null"`
}

// NotifyStages are the rows of notify_stages, in order
var NotifyStages = []NotifyStage{
	{NotifyNew, "new", "Added; the partner hasn't been told yet"},
	{NotifyAnnounced, "announced", "The partner was told it was added"},
	{NotifyRemindedDays, "reminded_3_days", "Reminded 3 days on, still not bought"},
	{NotifyDone, "reminded_1_week", "Reminded a week on; nothing further"},
}
