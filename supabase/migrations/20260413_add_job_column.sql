-- v2.0: Add job column for user profession
ALTER TABLE users ADD COLUMN IF NOT EXISTS job text;
