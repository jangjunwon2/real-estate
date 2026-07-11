-- 013_legacy_preference_fields.sql: user_preferences 테이블은 마이그레이션 폴더가
-- 생기기 전에 수동으로 만들어져서, 초기 재무정보 컬럼들이 어떤 마이그레이션에도
-- 기록되어 있지 않았다. birth_year가 프로덕션 DB에서 실제로 누락된 게 확인됐고,
-- 나머지 컬럼들도 동일하게 누락됐을 수 있어 전부 방어적으로 채워 넣는다.
-- (모두 IF NOT EXISTS라 이미 존재하는 컬럼은 안전하게 스킵됨)

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS regions text[] NOT NULL DEFAULT ARRAY['서울'],
  ADD COLUMN IF NOT EXISTS budget_min integer NOT NULL DEFAULT 30000,
  ADD COLUMN IF NOT EXISTS budget_max integer NOT NULL DEFAULT 60000,
  ADD COLUMN IF NOT EXISTS property_types text[] NOT NULL DEFAULT ARRAY['sale', 'subscription'],
  ADD COLUMN IF NOT EXISTS monthly_income integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assets integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_newlywed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_first_buyer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS no_home_years integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS num_children integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_to_recover integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gift_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS existing_loan_payment integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS renovation_budget integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_score_range text NOT NULL DEFAULT '800-900',
  ADD COLUMN IF NOT EXISTS birth_year integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
