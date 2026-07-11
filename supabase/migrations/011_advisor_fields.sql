-- 011_advisor_fields.sql: 구매 전략 추천 기능용 프로필 필드 추가

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS buyer_type text NOT NULL DEFAULT 'solo'
    CHECK (buyer_type IN ('solo', 'couple')),
  ADD COLUMN IF NOT EXISTS marriage_status text
    CHECK (marriage_status IS NULL OR marriage_status IN ('registered', 'planned', 'undetermined')),
  ADD COLUMN IF NOT EXISTS self_home_status text NOT NULL DEFAULT 'none'
    CHECK (self_home_status IN ('none', 'one', 'multiple')),
  ADD COLUMN IF NOT EXISTS spouse_home_status text
    CHECK (spouse_home_status IS NULL OR spouse_home_status IN ('none', 'one', 'multiple')),
  ADD COLUMN IF NOT EXISTS household_head boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS subscription_account_years numeric NOT NULL DEFAULT 0;

-- 기존 신혼부부 사용자는 couple로 백필
UPDATE user_preferences SET buyer_type = 'couple' WHERE is_newlywed = true;
