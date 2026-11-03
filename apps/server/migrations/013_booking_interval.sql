ALTER TABLE salon_settings
ADD COLUMN interval_minutes INTEGER NOT NULL DEFAULT 90 CHECK (interval_minutes BETWEEN 5 AND 240);
