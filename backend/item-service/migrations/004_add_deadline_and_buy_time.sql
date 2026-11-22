-- An item's deadline to buy and time to buy (not for restaurants), and which of
-- their nudges have gone out: 1 an hour before the deadline, 2 five minutes
-- before the time to buy, 4 at it (internal/nudge.go).
-- (Also added by database.InitDB's AutoMigrate from models.Item.)
ALTER TABLE items ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ;
ALTER TABLE items ADD COLUMN IF NOT EXISTS buy_at TIMESTAMPTZ;
ALTER TABLE items ADD COLUMN IF NOT EXISTS nudges_sent SMALLINT NOT NULL DEFAULT 0;
