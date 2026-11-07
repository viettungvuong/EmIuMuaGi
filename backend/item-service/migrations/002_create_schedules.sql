-- Meal dates on the calendar: when, which restaurant, and who booked it.
-- username is not a foreign key: users live in the user service's database
-- (emiumuagi_user), the same reason items.owner is a plain username.
-- (Also created by database.InitDB's AutoMigrate from models.Schedule.)
CREATE TABLE IF NOT EXISTS schedules (
    id            BIGSERIAL PRIMARY KEY,
    scheduled_at  TIMESTAMPTZ NOT NULL,
    restaurant_id BIGINT NOT NULL,
    username      VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ,
    CONSTRAINT fk_schedules_restaurant FOREIGN KEY (restaurant_id)
        REFERENCES restaurants (id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_schedules_scheduled_at ON schedules (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_schedules_restaurant_id ON schedules (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_schedules_username ON schedules (username);
