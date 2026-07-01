-- 006_schema_updates.sql: 스키마 보완 (signal, personalized_reason 등)

ALTER TABLE briefings ADD COLUMN IF NOT EXISTS signal text
  CHECK (signal IN ('buy','wait','avoid'));

ALTER TABLE briefings ADD COLUMN IF NOT EXISTS signal_reason text;
ALTER TABLE briefings ADD COLUMN IF NOT EXISTS articles_count int DEFAULT 0;
ALTER TABLE briefings ADD COLUMN IF NOT EXISTS urgent_count   int DEFAULT 0;

ALTER TABLE property_scores ADD COLUMN IF NOT EXISTS personalized_reason text;
