-- v1.4.0: Daha zengin profil alanları + bildirim tercihi
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS dating_intention text,
  ADD COLUMN IF NOT EXISTS family_plans text,
  ADD COLUMN IF NOT EXISTS education text,
  ADD COLUMN IF NOT EXISTS religion text,
  ADD COLUMN IF NOT EXISTS alcohol text,
  ADD COLUMN IF NOT EXISTS smoking text,
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean DEFAULT true;
