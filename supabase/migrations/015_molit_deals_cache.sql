-- 국토부 실거래가 조회 캐시: (시군구 법정동코드, 거래년월) 단위로 원본 거래 전체를 저장
-- TTL(24시간) 판단은 애플리케이션(fetched_at 비교)에서 수행
CREATE TABLE IF NOT EXISTS molit_deals_cache (
  lawd_cd    text NOT NULL,
  deal_ym    text NOT NULL,
  deals      jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lawd_cd, deal_ym)
);

-- 서버(service_role)만 접근: RLS 활성화 + 정책 없음 = anon/authenticated 차단
ALTER TABLE molit_deals_cache ENABLE ROW LEVEL SECURITY;
