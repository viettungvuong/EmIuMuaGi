-- The price on an item's shop page ("₫129.000"), read when someone signs in,
-- and when it was last read (internal/prices.go).
-- (Also added by database.InitDB's AutoMigrate from models.Item.)
ALTER TABLE items ADD COLUMN IF NOT EXISTS price VARCHAR(64);
ALTER TABLE items ADD COLUMN IF NOT EXISTS price_checked_at TIMESTAMPTZ;
