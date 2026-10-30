CREATE TABLE app_user (
    id VARCHAR(128) PRIMARY KEY,
    email VARCHAR(320) NOT NULL,
    display_name VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE household (
    id UUID PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    created_by VARCHAR(128) NOT NULL REFERENCES app_user(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE household_member (
    household_id UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,
    user_id VARCHAR(128) NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (household_id, user_id)
);

CREATE TABLE household_invite (
    id UUID PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,
    email VARCHAR(320) NOT NULL,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    invited_by VARCHAR(128) NOT NULL REFERENCES app_user(id),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX household_invite_email_idx ON household_invite(email);

CREATE TABLE bill (
    id UUID PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,
    uploaded_by VARCHAR(128) NOT NULL REFERENCES app_user(id),
    product_name VARCHAR(240),
    merchant VARCHAR(240),
    purchase_date DATE,
    warranty_months INTEGER,
    warranty_expires_at DATE,
    storage_path VARCHAR(700) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    ocr_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX bill_household_idx ON bill(household_id);
CREATE INDEX bill_expiry_idx ON bill(warranty_expires_at);

CREATE TABLE reminder_log (
    id UUID PRIMARY KEY,
    bill_id UUID NOT NULL REFERENCES bill(id) ON DELETE CASCADE,
    user_id VARCHAR(128) NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    reminder_date DATE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (bill_id, user_id, reminder_date)
);
