-- Adds restaurants.schedule (when to go eat there) to a database created before
-- the column existed. setup_db.sql uses CREATE TABLE IF NOT EXISTS, which skips
-- tables that are already there, so existing databases need this ALTER.
-- Safe to run more than once.
ALTER TABLE restaurants
    ADD COLUMN IF NOT EXISTS schedule TIMESTAMP WITH TIME ZONE NULL;
