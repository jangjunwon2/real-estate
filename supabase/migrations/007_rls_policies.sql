-- 007_rls_policies.sql: 공개 읽기 정책 추가
-- 실행 전: DROP POLICY IF EXISTS "articles_public_read" ON articles;

CREATE POLICY "articles_public_read" ON articles
  FOR SELECT USING (status = 'active');

CREATE POLICY "briefings_public_read" ON briefings
  FOR SELECT USING (true);

CREATE POLICY "properties_public_read" ON properties
  FOR SELECT USING (status = 'active');

CREATE POLICY "complexes_public_read" ON complexes
  FOR SELECT USING (true);

CREATE POLICY "property_scores_public_read" ON property_scores
  FOR SELECT USING (true);

CREATE POLICY "location_scores_public_read" ON location_scores
  FOR SELECT USING (true);

-- 사용자 자신의 데이터만 접근
CREATE POLICY "user_profiles_self" ON user_profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "subscriptions_self" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);
