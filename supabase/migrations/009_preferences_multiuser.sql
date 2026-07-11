-- 009_preferences_multiuser.sql: user_preferences 다중 사용자화

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS user_preferences_user_id_idx ON user_preferences (user_id);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- 사용자 자신의 설정만 읽기/쓰기
DROP POLICY IF EXISTS "user_preferences_self" ON user_preferences;
CREATE POLICY "user_preferences_self" ON user_preferences
  FOR ALL USING (auth.uid() = user_id);

-- 서비스 롤 전체 접근
DROP POLICY IF EXISTS "user_preferences_service" ON user_preferences;
CREATE POLICY "user_preferences_service" ON user_preferences
  FOR ALL USING (auth.role() = 'service_role');
