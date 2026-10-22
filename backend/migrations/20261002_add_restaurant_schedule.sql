-- Adds restaurants.schedule (when to go eat there) to a database created before
-- the column existed. setup_db.sql uses CREATE TABLE IF NOT EXISTS, which skips
-- tables that are already there, so existing databases need this ALTER.
-- Safe to run more than once, and on a fresh database (no restaurants table yet:
-- item-service creates it, schedule included, when it first starts).
ALTER TABLE IF EXISTS restaurants
    ADD COLUMN IF NOT EXISTS schedule TIMESTAMP WITH TIME ZONE NULL;
