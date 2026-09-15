package main

import "database/sql"

const schema = `
CREATE TABLE IF NOT EXISTS items (
	id SERIAL PRIMARY KEY,
	name TEXT NOT NULL UNIQUE,
	price DOUBLE PRECISION NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	image_url TEXT NOT NULL DEFAULT '',
	status TEXT NOT NULL DEFAULT 'available',
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE items ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE items ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';
ALTER TABLE items ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'available';

CREATE TABLE IF NOT EXISTS bills (
	id SERIAL PRIMARY KEY,
	customer_name TEXT NOT NULL DEFAULT '',
	payment_method TEXT NOT NULL DEFAULT '',
	total_amount DOUBLE PRECISION NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bill_items (
	id SERIAL PRIMARY KEY,
	bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
	item_name TEXT NOT NULL,
	unit_price DOUBLE PRECISION NOT NULL,
	quantity INTEGER NOT NULL,
	line_total DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS sales (
	id SERIAL PRIMARY KEY,
	sale_date DATE NOT NULL,
	amount DOUBLE PRECISION NOT NULL,
	notes TEXT NOT NULL DEFAULT '',
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
	id SERIAL PRIMARY KEY,
	customer_name TEXT NOT NULL DEFAULT '',
	customer_phone TEXT NOT NULL DEFAULT '',
	notes TEXT NOT NULL DEFAULT '',
	status TEXT NOT NULL DEFAULT 'pending',
	total_amount DOUBLE PRECISION NOT NULL,
	bill_id INTEGER REFERENCES bills(id),
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
	id SERIAL PRIMARY KEY,
	order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
	item_name TEXT NOT NULL,
	unit_price DOUBLE PRECISION NOT NULL,
	quantity INTEGER NOT NULL,
	line_total DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
	id SERIAL PRIMARY KEY,
	endpoint TEXT NOT NULL UNIQUE,
	p256dh TEXT NOT NULL,
	auth TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fcm_tokens (
	id SERIAL PRIMARY KEY,
	token TEXT NOT NULL UNIQUE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
`

func migrate(db *sql.DB) error {
	_, err := db.Exec(schema)
	return err
}
