-- =============================================================
-- seed_properties.sql
-- Supabase SQL 에디터에서 실행하면 샘플 매물이 즉시 표시됩니다.
-- =============================================================

-- complexes 테이블 컬럼 보완 (없으면 추가)
ALTER TABLE complexes ADD COLUMN IF NOT EXISTS built_year   int;
ALTER TABLE complexes ADD COLUMN IF NOT EXISTS total_units  int;
ALTER TABLE complexes ADD COLUMN IF NOT EXISTS builder      text;

-- ── 단지 (complexes) ─────────────────────────────────────────
INSERT INTO complexes (id, name, sigungu, road_address, lat, lng, built_year, total_units, builder) VALUES
  ('00000001-0000-0000-0000-000000000001', '마포래미안푸르지오',   '서울 마포구', '서울 마포구 월드컵북로 396',   37.5665, 126.9425, 2015, 2885, '삼성물산'),
  ('00000001-0000-0000-0000-000000000002', '은평롯데캐슬시그니처', '서울 은평구', '서울 은평구 갈현로 26',        37.6221, 126.9291, 2021,  612, '롯데건설'),
  ('00000001-0000-0000-0000-000000000003', '서대문푸르지오센트럴파크', '서울 서대문구', '서울 서대문구 성산로 553', 37.5802, 126.9324, 2022,  847, '대우건설'),
  ('00000001-0000-0000-0000-000000000004', '송파헬리오시티',       '서울 송파구', '서울 송파구 올림픽로 300',     37.5090, 127.1046, 2018, 9510, 'SK건설'),
  ('00000001-0000-0000-0000-000000000005', '성남판교알파돔시티',   '경기 성남시', '경기 성남시 분당구 판교역로 166', 37.3946, 127.1107, 2014, 2494, '대림산업'),
  ('00000001-0000-0000-0000-000000000006', '고덕강일리엔파크',     '서울 강동구', '서울 강동구 강일동 643',        37.5608, 127.1810, 2021,  576, '한화건설')
ON CONFLICT (id) DO UPDATE SET
  name         = EXCLUDED.name,
  sigungu      = EXCLUDED.sigungu,
  road_address = EXCLUDED.road_address,
  lat          = EXCLUDED.lat,
  lng          = EXCLUDED.lng,
  built_year   = EXCLUDED.built_year,
  total_units  = EXCLUDED.total_units,
  builder      = EXCLUDED.builder;

-- ── 입지 점수 (location_scores) ──────────────────────────────
INSERT INTO location_scores (complex_id, nearest_subway, nearest_subway_min, mart_min, hospital_min, park_min, school_score, school_count_1km, convenience_score) VALUES
  ('00000001-0000-0000-0000-000000000001', '마포구청역 (6호선)', 5,  8, 10, 7, 85, 3, 80),
  ('00000001-0000-0000-0000-000000000002', '구파발역 (3호선)',   8, 10, 12, 5, 78, 2, 70),
  ('00000001-0000-0000-0000-000000000003', '홍제역 (3호선)',     7,  6,  8, 9, 82, 3, 75),
  ('00000001-0000-0000-0000-000000000004', '방이역 (5호선)',     6,  5,  7, 4, 90, 4, 88),
  ('00000001-0000-0000-0000-000000000005', '판교역 (신분당선)',  3,  5,  8, 6, 88, 3, 85),
  ('00000001-0000-0000-0000-000000000006', '강일역 (5호선)',     4,  8, 10, 3, 75, 2, 72)
ON CONFLICT (complex_id) DO NOTHING;

-- ── 매물 (properties) ─────────────────────────────────────────
-- source_url: 실제 작동하는 네이버 부동산 / 공공기관 URL
INSERT INTO properties (id, complex_id, property_type, source, source_url, title, price, floor, area_sqm, bid_count, subscription_start, subscription_end, auction_date, status) VALUES

  -- 매매 (네이버 부동산 단지 검색 페이지)
  ('00000002-0000-0000-0000-000000000001', '00000001-0000-0000-0000-000000000001',
   'sale', 'naver', 'https://new.land.naver.com/search?query=%EB%A7%88%ED%8F%AC%EB%9E%98%EB%AF%B8%EC%95%88%ED%91%B8%EB%A5%B4%EC%A7%80%EC%98%A4',
   '마포래미안푸르지오 84A 20층 매매', 97000, 20, 84.95, 0, NULL, NULL, NULL, 'active'),

  ('00000002-0000-0000-0000-000000000002', '00000001-0000-0000-0000-000000000003',
   'sale', 'naver', 'https://new.land.naver.com/search?query=%EC%84%9C%EB%8C%80%EB%AC%B8%ED%91%B8%EB%A5%B4%EC%A7%80%EC%98%A4%EC%84%BC%ED%8A%B8%EB%9F%B4%ED%8C%8C%ED%81%AC',
   '서대문푸르지오센트럴파크 59A 8층 매매', 74000, 8, 59.91, 0, NULL, NULL, NULL, 'active'),

  ('00000002-0000-0000-0000-000000000003', '00000001-0000-0000-0000-000000000004',
   'sale', 'naver', 'https://new.land.naver.com/search?query=%ED%97%AC%EB%A6%AC%EC%98%A4%EC%8B%9C%ED%8B%B0',
   '송파헬리오시티 84B 14층 매매', 126000, 14, 84.84, 0, NULL, NULL, NULL, 'active'),

  ('00000002-0000-0000-0000-000000000004', '00000001-0000-0000-0000-000000000005',
   'sale', 'naver', 'https://new.land.naver.com/search?query=%ED%8C%90%EA%B5%90%EC%95%8C%ED%8C%8C%EB%8F%94%EC%8B%9C%ED%8B%B0',
   '성남판교알파돔시티 115 6층 매매', 148000, 6, 115.24, 0, NULL, NULL, NULL, 'active'),

  -- 경매 (대법원 경매정보)
  ('00000002-0000-0000-0000-000000000005', '00000001-0000-0000-0000-000000000002',
   'auction', 'court', 'https://www.courtauction.go.kr/RetrieveRealEstList.laf',
   '[경매] 은평롯데캐슬시그니처 59B 5층 (감정가 65,000만원)', 54000, 5, 59.71, 2,
   NULL, NULL, '2026-07-25', 'active'),

  ('00000002-0000-0000-0000-000000000006', '00000001-0000-0000-0000-000000000006',
   'auction', 'court', 'https://www.courtauction.go.kr/RetrieveRealEstList.laf?searchDate=2026-07',
   '[경매] 고덕강일리엔파크 84C 11층 (감정가 73,000만원)', 62000, 11, 84.93, 1,
   NULL, NULL, '2026-07-31', 'active'),

  -- 청약 (청약홈)
  ('00000002-0000-0000-0000-000000000007', '00000001-0000-0000-0000-000000000003',
   'subscription', 'applyhome', 'https://www.applyhome.co.kr/ai/aia/selectSubscrptHouseList.do',
   '[청약] 서대문푸르지오센트럴파크 2단지 84A (분양가 82,000만원)', 82000, NULL, 84.87, 0,
   '2026-07-10', '2026-07-15', NULL, 'active'),

  ('00000002-0000-0000-0000-000000000008', '00000001-0000-0000-0000-000000000006',
   'subscription', 'applyhome', 'https://www.applyhome.co.kr/ai/aia/selectSubscrptHouseList.do?sidoCode=11',
   '[청약] 고덕강일리엔파크 2차 59A (분양가 58,000만원)', 58000, NULL, 59.52, 0,
   '2026-07-20', '2026-07-25', NULL, 'active')

ON CONFLICT (id) DO UPDATE SET
  source_url = EXCLUDED.source_url,
  source     = EXCLUDED.source;

-- ── AI 분석 점수 (property_scores) ───────────────────────────
INSERT INTO property_scores (property_id, price_score, location_score, complex_score, demand_score, regulatory_score, total_score, pros, cons, ai_summary, personalized_reason) VALUES

  ('00000002-0000-0000-0000-000000000001', 14, 22, 18, 17, 11, 82,
   ARRAY['마포구청역 5분 역세권', '2015년 준공 비교적 신축', '대단지(2885세대) 관리 양호'],
   ARRAY['토지거래허가구역 인접', '84m² 기준 시세 대비 소폭 고평가'],
   '마포 대장 단지 중 하나로 역세권·학군·편의시설 3박자. 최근 가격 조정으로 매수 기회 가능.',
   '신혼생애최초 LTV 80% 적용 시 약 7,760만원 자기자본으로 접근 가능한 우량 매물.'),

  ('00000002-0000-0000-0000-000000000002', 16, 19, 16, 15, 13, 79,
   ARRAY['2022년 신축 브랜드 아파트', '홍제역 7분 역세권', '서울 서북권 재개발 수혜'],
   ARRAY['소단지(847세대) 한계', '주변 노후 주거지 혼재'],
   '서대문구 신축 단지 중 가격 메리트 있음. 인근 재개발 진행으로 중장기 가치 기대.',
   '59m² 실거주 목적 신혼부부에게 합리적 선택. 취득세 감면 최대 200만원 적용 가능.'),

  ('00000002-0000-0000-0000-000000000003', 10, 24, 19, 19, 9, 81,
   ARRAY['국내 최대 단지(9510세대) 커뮤니티', '방이역·올림픽공원 인접', '학군·학원가 우수'],
   ARRAY['토지거래허가구역', '12억 초과로 LTV 40% 제한', '투기과열지구 DSR 40% 적용'],
   '헬리오시티는 입지·단지 모두 최상급이나 규제 복잡. 자기자본 요구액이 높아 신혼부부 접근 난이도 상.',
   '예산 1.2억 이상 + 신혼디딤돌 적용 불가(가격 초과). 일반 주담대 또는 보금자리론 검토 필요.'),

  ('00000002-0000-0000-0000-000000000004', 11, 20, 17, 18, 12, 78,
   ARRAY['판교역 3분 초역세권', '신분당선·경강선 환승', 'IT 기업 직주근접'],
   ARRAY['15억 초과로 주담대 LTV 0% 적용 불가', '분당구 투기과열지구'],
   '판교 핵심 입지 프리미엄. 그러나 고가 주택 규제로 대출 없이 전액 현금 필요해 실수요 한계.',
   '자기자본 14.8억 이상 필요. 신혼부부 대출 상품 적용 불가 구간. 투자 목적 여유 자금 있을 때 검토.'),

  ('00000002-0000-0000-0000-000000000005', 18, 16, 15, 13, 14, 76,
   ARRAY['시세 대비 15% 할인된 낙찰 예상가', '2021년 신축', '은평뉴타운 인프라'],
   ARRAY['명도 소요 2~3개월', '등기부 확인 필수 (선순위 임차인)', '3호선 환승 거리'],
   '감정가 6.5억 대비 낙찰가율 83% 예상. 명도·권리분석 비용 포함해도 시세 대비 메리트 있음.',
   '경매는 법무사·명도비 약 200~500만원 별도. 생애최초 취득세 감면 적용 가능. 신중한 권리분석 필수.'),

  ('00000002-0000-0000-0000-000000000006', 17, 17, 14, 14, 14, 76,
   ARRAY['감정가 대비 약 15% 할인', '강동구 미래 가치 기대', '84m² 실거주 적합'],
   ARRAY['경매 1회 유찰 이력', '강동구 신도시 개발 리스크', '강일역 개통 일정 변수'],
   '강동구 개발 수혜 기대 지역. 경매 낙찰 시 시세 대비 유리. 1회 유찰로 추가 유찰 가능성 낮음.',
   '디딤돌 신혼생애최초 적용 시 약 5,200만원으로 진입 가능한 경매 매물. 권리분석 비용 감안 필요.'),

  ('00000002-0000-0000-0000-000000000007', 15, 19, 16, 17, 13, 80,
   ARRAY['서울 신축 청약 희귀 기회', '홍제역 역세권 분양가 메리트', '청약 가점 50점 이하도 기회'],
   ARRAY['청약 가점 경쟁 예상 (가점 35점+)', '계약금 10% 납부 즉시 필요', '입주까지 2년 대기'],
   '서대문구 신규 분양으로 주변 시세 대비 10% 내외 할인 예상. 84A 타입 특별공급 신혼부부 몫 다수.',
   '신혼부부 특별공급 대상. 가점 낮아도 혼인신고 후 7년 이내 신청 가능. 분양가 상한제 미적용 주의.'),

  ('00000002-0000-0000-0000-000000000008', 16, 17, 14, 14, 14, 75,
   ARRAY['강동구 신규 분양 메리트', '59A 소형 실수요 강세', '분양가 상한제 적용 가능성'],
   ARRAY['가점 40점 이상 경쟁 예상', '강일지구 학군 형성 미완성', '입주 시점 공급 과잉 우려'],
   '강동구 신도시 내 위치. 소형 타입으로 신혼부부 수요 집중. 분양가 대비 주변 시세 형성 여부가 관건.',
   '신생아 특례 대출 자격 시 금리 1.6~3.3% 적용으로 월 상환 부담 크게 감소 가능.')

ON CONFLICT (property_id) DO NOTHING;

-- ── 기존에 가짜 URL로 삽입된 경우 실제 URL로 업데이트 ────────
UPDATE properties SET source_url = 'https://new.land.naver.com/search?query=%EB%A7%88%ED%8F%AC%EB%9E%98%EB%AF%B8%EC%95%88%ED%91%B8%EB%A5%B4%EC%A7%80%EC%98%A4', source = 'naver'
  WHERE id = '00000002-0000-0000-0000-000000000001';
UPDATE properties SET source_url = 'https://new.land.naver.com/search?query=%EC%84%9C%EB%8C%80%EB%AC%B8%ED%91%B8%EB%A5%B4%EC%A7%80%EC%98%A4%EC%84%BC%ED%8A%B8%EB%9F%B4%ED%8C%8C%ED%81%AC', source = 'naver'
  WHERE id = '00000002-0000-0000-0000-000000000002';
UPDATE properties SET source_url = 'https://new.land.naver.com/search?query=%ED%97%AC%EB%A6%AC%EC%98%A4%EC%8B%9C%ED%8B%B0', source = 'naver'
  WHERE id = '00000002-0000-0000-0000-000000000003';
UPDATE properties SET source_url = 'https://new.land.naver.com/search?query=%ED%8C%90%EA%B5%90%EC%95%8C%ED%8C%8C%EB%8F%94%EC%8B%9C%ED%8B%B0', source = 'naver'
  WHERE id = '00000002-0000-0000-0000-000000000004';
UPDATE properties SET source_url = 'https://www.courtauction.go.kr/RetrieveRealEstList.laf', source = 'court'
  WHERE id = '00000002-0000-0000-0000-000000000005';
UPDATE properties SET source_url = 'https://www.courtauction.go.kr/RetrieveRealEstList.laf?searchDate=2026-07', source = 'court'
  WHERE id = '00000002-0000-0000-0000-000000000006';
UPDATE properties SET source_url = 'https://www.applyhome.co.kr/ai/aia/selectSubscrptHouseList.do', source = 'applyhome'
  WHERE id = '00000002-0000-0000-0000-000000000007';
UPDATE properties SET source_url = 'https://www.applyhome.co.kr/ai/aia/selectSubscrptHouseList.do?sidoCode=11', source = 'applyhome'
  WHERE id = '00000002-0000-0000-0000-000000000008';
