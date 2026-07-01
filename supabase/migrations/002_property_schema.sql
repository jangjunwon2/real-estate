-- 002_property_schema.sql: 매물/단지/스코어 테이블

CREATE TABLE IF NOT EXISTS complexes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  sigungu          text NOT NULL,
  road_address     text,
  jibun_address    text,
  lat              numeric(10,7),
  lng              numeric(10,7),
  molit_complex_id text UNIQUE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS complexes_sigungu_idx ON complexes (sigungu);
CREATE INDEX IF NOT EXISTS complexes_name_idx    ON complexes (name);

CREATE TABLE IF NOT EXISTS properties (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id          uuid REFERENCES complexes(id) ON DELETE SET NULL,
  property_type       text NOT NULL CHECK (property_type IN ('sale','auction','subscription')),
  source              text NOT NULL,
  source_url          text NOT NULL UNIQUE,
  title               text,
  price               int,
  floor               int,
  area_sqm            numeric(7,2),
  auction_date        date,
  bid_count           int NOT NULL DEFAULT 0,
  subscription_start  date,
  subscription_end    date,
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','cancelled')),
  pipeline_run_id     uuid REFERENCES pipeline_runs(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS properties_status_idx  ON properties (status);
CREATE INDEX IF NOT EXISTS properties_type_idx    ON properties (property_type);
CREATE INDEX IF NOT EXISTS properties_created_idx ON properties (created_at DESC);

CREATE TABLE IF NOT EXISTS property_scores (
  property_id         uuid PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
  price_score         int NOT NULL DEFAULT 0 CHECK (price_score BETWEEN 0 AND 20),
  location_score      int NOT NULL DEFAULT 0 CHECK (location_score BETWEEN 0 AND 25),
  complex_score       int NOT NULL DEFAULT 0 CHECK (complex_score BETWEEN 0 AND 20),
  demand_score        int NOT NULL DEFAULT 0 CHECK (demand_score BETWEEN 0 AND 20),
  regulatory_score    int NOT NULL DEFAULT 0 CHECK (regulatory_score BETWEEN 0 AND 15),
  total_score         int NOT NULL DEFAULT 0 CHECK (total_score BETWEEN 0 AND 100),
  pros                text[] DEFAULT '{}',
  cons                text[] DEFAULT '{}',
  ai_summary          text,
  personalized_reason text,
  scored_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS location_scores (
  complex_id          uuid PRIMARY KEY REFERENCES complexes(id) ON DELETE CASCADE,
  nearest_subway      text,
  nearest_subway_min  int,
  school_score        int NOT NULL DEFAULT 0,
  school_count_1km    int NOT NULL DEFAULT 0,
  convenience_score   int NOT NULL DEFAULT 0,
  mart_min            int,
  hospital_min        int,
  park_min            int,
  scored_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE complexes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties      ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_scores ENABLE ROW LEVEL SECURITY;
