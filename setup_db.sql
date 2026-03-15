-- Create items table
CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    item_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    buy_url VARCHAR(2048),
    shop_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    item_type VARCHAR(50) NOT NULL,
    bought BOOLEAN NOT NULL DEFAULT FALSE
);

-- Create clothes table
CREATE TABLE IF NOT EXISTS clothes (
    id INTEGER PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    size VARCHAR(20),
    color VARCHAR(50),
    brand VARCHAR(100)
);

-- Create food_and_drinks table
CREATE TABLE IF NOT EXISTS food_and_drinks (
    id INTEGER PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    sugar VARCHAR(100),
    size VARCHAR(20),
    notes VARCHAR(500),
    toppings JSONB
);

-- Create others table
CREATE TABLE IF NOT EXISTS others (
    id INTEGER PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    category VARCHAR(100),
    notes VARCHAR(500)
);

-- Create histories table
CREATE TABLE IF NOT EXISTS histories (
    id UUID PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY,
    history_id UUID NOT NULL REFERENCES histories(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    content TEXT
);