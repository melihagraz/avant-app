-- Hinge-style prompts (kullanıcı havuzdan 3 soru seçip cevaplar)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS prompts jsonb DEFAULT '[]'::jsonb;

-- Çoklu uyumluluk metriği (values, communication, lifestyle, humor)
ALTER TABLE agent_conversations
  ADD COLUMN IF NOT EXISTS compatibility_breakdown jsonb;
