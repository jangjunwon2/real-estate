-- 010_income_mode.sql: 신혼부부 소득 입력 방식(합산/개별) 지원

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS income_mode text NOT NULL DEFAULT 'combined'
    CHECK (income_mode IN ('combined', 'individual')),
  ADD COLUMN IF NOT EXISTS income_self integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS income_spouse integer NOT NULL DEFAULT 0;
