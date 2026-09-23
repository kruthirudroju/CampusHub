USE campushub;

ALTER TABLE users ADD COLUMN last_checked_notifications TIMESTAMP NULL DEFAULT NULL;