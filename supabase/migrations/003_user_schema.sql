-- 003_user_schema.sql: 사용자 프로필 & 구독

CREATE TABLE IF NOT EXISTS user_profiles (
  id                uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             text,
  tier              text NOT NULL DEFAULT 'free' CHECK (tier IN ('free','basic','premium')),
  subscription_end  timestamptz,
  phone             text,
  region_interest   text,
  budget_min        int,
  budget_max        int,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier        text NOT NULL CHECK (tier IN ('basic','premium')),
  amount      int NOT NULL,
  payment_key text NOT NULL,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','expired')),
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON subscriptions (user_id);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
