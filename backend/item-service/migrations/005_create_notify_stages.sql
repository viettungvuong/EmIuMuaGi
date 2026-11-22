-- Lookup table for items.notify_stage, so its numbers read as names.
-- (Also done by database.InitDB, from models.NotifyStages.)
CREATE TABLE IF NOT EXISTS notify_stages (
    id          SMALLINT PRIMARY KEY,
    name        VARCHAR(32) NOT NULL UNIQUE,
    description VARCHAR(255) NOT NULL
);
INSERT INTO notify_stages (id, name, description) VALUES
    (0, 'new', 'Added; the partner hasn''t been told yet'),
    (1, 'announced', 'The partner was told it was added'),
    (2, 'reminded_3_days', 'Reminded 3 days on, still not bought'),
    (3, 'reminded_1_week', 'Reminded a week on; nothing further')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_items_notify_stage') THEN
        ALTER TABLE items ADD CONSTRAINT fk_items_notify_stage
            FOREIGN KEY (notify_stage) REFERENCES notify_stages (id);
    END IF;
END $$;
