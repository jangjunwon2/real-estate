-- 일시적 2주택 처분 조건 (2025.6.27 대책 유주택자 주담대 금지의 예외)
-- 1주택 세대가 기존 주택 처분을 약정하고 매수하는 경우 무주택에 준해 대출 심사
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS disposal_planned boolean NOT NULL DEFAULT false;
