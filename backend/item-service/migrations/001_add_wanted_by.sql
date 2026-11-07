-- Who of the couple wants the item: 0 = girl, 1 = boy.
-- Existing items were all hers, so they default to 0.
-- (Also run by database.InitDB on startup.)
ALTER TABLE items
    ADD COLUMN IF NOT EXISTS wanted_by SMALLINT NOT NULL DEFAULT 0 CHECK (wanted_by IN (0, 1));
