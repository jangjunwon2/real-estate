-- 008_favorites_notifications.sql: 즐겨찾기 테이블 + 알림 설정

-- 즐겨찾기
CREATE TABLE IF NOT EXISTS favorites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, property_id)
);

CREATE INDEX IF NOT EXISTS favorites_user_idx ON favorites (user_id);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "favorites_self" ON favorites;
CREATE POLICY "favorites_self" ON favorites
  FOR ALL USING (auth.uid() = user_id);

-- 알림 설정 컬럼 추가
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS notify_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_kakao boolean NOT NULL DEFAULT false;
