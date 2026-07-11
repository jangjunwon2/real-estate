-- 012_policy_change_proposals.sql: 정책 변경 감지 제안 테이블

CREATE TABLE IF NOT EXISTS policy_change_proposals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_url     text,
  article_title   text NOT NULL,
  regulation_path text NOT NULL,
  ai_summary      text NOT NULL,
  proposed_diff   text NOT NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  detected_at     timestamptz NOT NULL DEFAULT now(),
  reviewed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS policy_change_proposals_status_idx ON policy_change_proposals (status);

ALTER TABLE policy_change_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "policy_change_proposals_service" ON policy_change_proposals;
CREATE POLICY "policy_change_proposals_service" ON policy_change_proposals
  FOR ALL USING (auth.role() = 'service_role');
