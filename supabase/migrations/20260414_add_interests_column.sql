-- v2.0: Add interests array for user hobbies/interests
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests text[] DEFAULT '{}';
