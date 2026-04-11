-- Hybrid Discover Feed: manual likes + daily limits + discoverable flag

-- 1. User likes table (normal, super_like, pass)
CREATE TABLE IF NOT EXISTS user_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  liker_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  liked_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL CHECK (action IN ('like', 'super_like', 'pass')),
  comment text,
  target_photo_index integer,
  target_prompt_key text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (liker_id, liked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_likes_liker ON user_likes(liker_id);
CREATE INDEX IF NOT EXISTS idx_user_likes_liked ON user_likes(liked_id);
CREATE INDEX IF NOT EXISTS idx_user_likes_created ON user_likes(created_at DESC);

-- 2. Daily like/super_like counters
CREATE TABLE IF NOT EXISTS daily_like_stats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date date DEFAULT CURRENT_DATE,
  like_count integer DEFAULT 0,
  super_like_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_like_stats_user_date ON daily_like_stats(user_id, date);

-- 3. Users: discoverable flag + last active timestamp
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_discoverable boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz DEFAULT now();

-- 4. RLS policies for user_likes
ALTER TABLE user_likes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_likes' AND policyname = 'Users can insert own likes') THEN
    CREATE POLICY "Users can insert own likes" ON user_likes
      FOR INSERT WITH CHECK (auth.uid() = liker_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_likes' AND policyname = 'Users can view own likes') THEN
    CREATE POLICY "Users can view own likes" ON user_likes
      FOR SELECT USING (auth.uid() = liker_id OR auth.uid() = liked_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_likes' AND policyname = 'Service role full access likes') THEN
    CREATE POLICY "Service role full access likes" ON user_likes
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 5. RLS policies for daily_like_stats
ALTER TABLE daily_like_stats ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_like_stats' AND policyname = 'Users can view own stats') THEN
    CREATE POLICY "Users can view own stats" ON daily_like_stats
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_like_stats' AND policyname = 'Service role full access stats') THEN
    CREATE POLICY "Service role full access stats" ON daily_like_stats
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 6. Users table: add policy for discover browsing (SELECT public columns)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can browse discoverable profiles') THEN
    CREATE POLICY "Users can browse discoverable profiles" ON users
      FOR SELECT
      USING (
        is_discoverable = true
        AND auth.uid() IS NOT NULL
      );
  END IF;
END $$;
