-- 001_news_schema.sql: 핵심 테이블 (articles, pipeline_runs, briefings)

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  status         text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','failed')),
  articles_fetched int,
  articles_saved   int,
  articles_skipped int,
  error_message  text
);

CREATE TABLE IF NOT EXISTS articles (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source         text NOT NULL,
  title          text NOT NULL,
  url            text NOT NULL UNIQUE,
  content        text,
  published_at   timestamptz,
  category       text,
  regions        text[] DEFAULT '{}',
  importance     int NOT NULL DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  urgent         boolean NOT NULL DEFAULT false,
  summary        text,
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active','hidden','deleted')),
  pipeline_run_id uuid REFERENCES pipeline_runs(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS articles_created_at_idx ON articles (created_at DESC);
CREATE INDEX IF NOT EXISTS articles_status_idx     ON articles (status);
CREATE INDEX IF NOT EXISTS articles_urgent_idx     ON articles (urgent) WHERE urgent = true;
CREATE INDEX IF NOT EXISTS articles_category_idx   ON articles (category);

CREATE TABLE IF NOT EXISTS briefings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content         text NOT NULL,
  signal          text CHECK (signal IN ('buy','wait','avoid')),
  signal_reason   text,
  articles_count  int NOT NULL DEFAULT 0,
  urgent_count    int NOT NULL DEFAULT 0,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  pipeline_run_id uuid REFERENCES pipeline_runs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS briefings_generated_at_idx ON briefings (generated_at DESC);

ALTER TABLE articles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
