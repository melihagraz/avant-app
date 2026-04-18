-- v2.0: Add monogamy preference column
ALTER TABLE users ADD COLUMN IF NOT EXISTS monogamy text;
