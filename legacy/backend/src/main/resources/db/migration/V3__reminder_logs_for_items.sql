ALTER TABLE reminder_log ALTER COLUMN bill_id DROP NOT NULL;
ALTER TABLE reminder_log ADD COLUMN item_id UUID REFERENCES warranty_item(id) ON DELETE CASCADE;

ALTER TABLE reminder_log
    ADD CONSTRAINT reminder_log_item_user_date_uq
    UNIQUE (item_id, user_id, reminder_date);

ALTER TABLE reminder_log
    ADD CONSTRAINT reminder_log_exactly_one_subject_ck
    CHECK ((bill_id IS NOT NULL AND item_id IS NULL) OR (bill_id IS NULL AND item_id IS NOT NULL));
