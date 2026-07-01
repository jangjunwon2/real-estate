-- 004_rls.sql: Service Role 전용 정책 (파이프라인 write 권한)

-- pipeline_runs: service role 전용
CREATE POLICY "pipeline_runs_service_all" ON pipeline_runs
  FOR ALL USING (auth.role() = 'service_role');

-- articles: 공개 읽기, service role 쓰기
CREATE POLICY "articles_service_all" ON articles
  FOR ALL USING (auth.role() = 'service_role');

-- briefings: 공개 읽기, service role 쓰기
CREATE POLICY "briefings_service_all" ON briefings
  FOR ALL USING (auth.role() = 'service_role');

-- properties: 공개 읽기, service role 쓰기
CREATE POLICY "properties_service_all" ON properties
  FOR ALL USING (auth.role() = 'service_role');

-- complexes: 공개 읽기, service role 쓰기
CREATE POLICY "complexes_service_all" ON complexes
  FOR ALL USING (auth.role() = 'service_role');

-- property_scores: service role 전용
CREATE POLICY "property_scores_service_all" ON property_scores
  FOR ALL USING (auth.role() = 'service_role');

-- location_scores: service role 전용
CREATE POLICY "location_scores_service_all" ON location_scores
  FOR ALL USING (auth.role() = 'service_role');
