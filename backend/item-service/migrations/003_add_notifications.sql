-- The notification digest (internal/notify.go).
-- (Also run by database.InitDB on startup.)

-- How far the digest has got with each item: 0 not announced to the partner yet,
-- 1 announced, 2 reminded 3 days on, 3 reminded a week on. Items from before
-- are put past the news they would have had by now.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'items' AND column_name = 'notify_stage') THEN
        ALTER TABLE items ADD COLUMN notify_stage SMALLINT NOT NULL DEFAULT 0;
        UPDATE items SET notify_stage = CASE
                WHEN created_at > now() - interval '3 days' THEN 1
                WHEN created_at > now() - interval '7 days' THEN 2
                ELSE 3 END;
    END IF;
END $$;

-- The phones that get it. username is not a foreign key, like schedules.username.
CREATE TABLE IF NOT EXISTS push_tokens (
    token      VARCHAR(255) PRIMARY KEY,
    username   VARCHAR(255) NOT NULL,
    language   VARCHAR(5) NOT NULL DEFAULT 'vi',
    updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_username ON push_tokens (username);
