CREATE TABLE warranty_item (
    id UUID PRIMARY KEY,
    name VARCHAR(240) NOT NULL,
    brand VARCHAR(200),
    category VARCHAR(120),
    purchase_date DATE,
    purchase_price NUMERIC(12, 2),
    warranty_months INTEGER,
    expiry_date DATE,
    bill_path VARCHAR(700),
    notes TEXT,
    household_id UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,
    created_by VARCHAR(128) NOT NULL REFERENCES app_user(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX warranty_item_household_idx ON warranty_item(household_id);
CREATE INDEX warranty_item_expiry_idx ON warranty_item(expiry_date);
