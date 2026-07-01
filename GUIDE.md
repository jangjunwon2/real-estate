# 부동산 AI 어드바이저 — 전체 구현 가이드

> 신혼부부 생애최초 대출 중심 부동산 뉴스 AI 큐레이션 서비스.  
> GitHub Actions Python 파이프라인 → Next.js 15 (Vercel) → Supabase PostgreSQL

---

## 1. 시스템 구조

```
┌─────────────────────────────────────────────────────────┐
│  PYTHON PIPELINE (GitHub Actions Cron 매일 06:00 KST)   │
│  ① crawl   → 네이버/국토부/한은/청약홈/RSS/온비드/법원경매 │
│  ② dedup   → URL 기반 중복 제거                          │
│  ③ classify → Claude Haiku 4.5 배치 분류 (10건/호출)    │
│  ④ ingest  → POST /api/pipeline/ingest                  │
│  ⑤ brief   → Claude Haiku 브리핑 + 매수신호 생성         │
│  ⑥ score  → 매물 AI 점수화 (100점 만점)                  │
│  ⑦ notify  → Resend 이메일 + Solapi 카카오 알림톡        │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP + X-Pipeline-Key
                       ▼
┌─────────────────────────────────────────────────────────┐
│  NEXT.JS 15 (Vercel)                                    │
│  /api/pipeline/*  ← PIPELINE_API_KEY                   │
│  /api/articles/*  ← 인증 없음 (Rate Limit: 60req/min)  │
│  /api/admin/*     ← ADMIN_API_KEY                      │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│  SUPABASE (PostgreSQL + RLS + pgBouncer)                │
│  articles / pipeline_runs / briefings                   │
│  complexes / properties / property_scores               │
│  (Phase 2: user_profiles / subscriptions)               │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 기술 스택

| 레이어 | 기술 |
|--------|------|
| 파이프라인 | Python 3.12, httpx, playwright-stealth, anthropic |
| AI 분류/브리핑 | Claude Haiku 4.5 (배치), Claude Sonnet 4.6 (Phase 3 프리미엄) |
| 웹 프레임워크 | Next.js 15 App Router (TypeScript) |
| 배포 | Vercel (웹), GitHub Actions (파이프라인) |
| DB | Supabase PostgreSQL + pgBouncer (Transaction mode) |
| 이메일 | Resend |
| 알림톡 | Solapi (카카오 알림톡) |
| 지도 | Kakao Map JS API (클라이언트), Kakao REST API (서버) |
| 결제 | Toss Payments (Phase 2) |
| 차트 | recharts |
| 폼 검증 | zod |

---

## 3. 폴더 구조

```
부동산/
├── pipeline/
│   ├── requirements.txt
│   ├── main.py
│   ├── config.py
│   ├── client.py
│   ├── crawlers/
│   │   ├── base.py
│   │   ├── naver_news.py
│   │   ├── rss.py
│   │   ├── public_apis.py
│   │   ├── onbid.py
│   │   └── court_auction.py
│   ├── processors/
│   │   ├── dedup.py
│   │   ├── classifier.py
│   │   ├── briefing_generator.py
│   │   ├── complex_mapper.py
│   │   ├── location_analyzer.py
│   │   └── property_scorer.py
│   ├── notifiers/
│   │   ├── email.py
│   │   ├── kakao.py
│   │   └── alert_failure.py
│   └── tests/
│       ├── test_crawlers.py
│       ├── test_dedup.py
│       ├── test_classifier.py
│       ├── test_client.py
│       ├── test_property_scorer.py
│       └── test_location_analyzer.py
├── web/
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── postcss.config.mjs
│   ├── middleware.ts
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   ├── loading.tsx
│   │   ├── error.tsx
│   │   ├── not-found.tsx
│   │   ├── news/page.tsx
│   │   ├── properties/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── login/page.tsx
│   │   ├── pricing/page.tsx
│   │   ├── auth/callback/route.ts
│   │   ├── admin/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   └── api/
│   │       ├── pipeline/run/start/route.ts
│   │       ├── pipeline/run/finish/route.ts
│   │       ├── pipeline/ingest/route.ts
│   │       ├── pipeline/briefing/route.ts
│   │       ├── pipeline/properties/ingest/route.ts
│   │       ├── articles/route.ts
│   │       ├── articles/[id]/route.ts
│   │       ├── briefing/today/route.ts
│   │       ├── properties/route.ts
│   │       ├── properties/[id]/route.ts
│   │       ├── properties/today-picks/route.ts
│   │       ├── payments/confirm/route.ts
│   │       ├── admin/stats/route.ts
│   │       ├── admin/pipeline/runs/route.ts
│   │       ├── admin/pipeline/trigger/route.ts
│   │       ├── admin/articles/route.ts
│   │       ├── admin/articles/[id]/route.ts
│   │       ├── admin/articles/[id]/reclassify/route.ts
│   │       ├── admin/properties/route.ts
│   │       └── admin/properties/[id]/rescore/route.ts
│   ├── components/
│   │   ├── layout/Nav.tsx
│   │   ├── layout/Footer.tsx
│   │   ├── ui/Badge.tsx
│   │   ├── ui/ScoreRing.tsx
│   │   ├── ui/SkeletonCard.tsx
│   │   ├── ui/FreemiumGate.tsx
│   │   ├── dashboard/BuyingSignal.tsx
│   │   ├── articles/ArticleCard.tsx
│   │   ├── articles/ArticleList.tsx
│   │   ├── articles/CategoryFilter.tsx
│   │   ├── articles/UrgentBanner.tsx
│   │   ├── briefing/BriefingCard.tsx
│   │   ├── properties/PropertyCard.tsx
│   │   ├── properties/ScoreRadarChart.tsx
│   │   ├── properties/TransactionChart.tsx
│   │   ├── properties/KakaoMap.tsx
│   │   ├── properties/EligibilityBadge.tsx
│   │   ├── properties/LoanCalculator.tsx
│   │   ├── properties/SubscriptionCountdown.tsx
│   │   └── admin/StatsCards.tsx
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── auth.ts
│   │   └── validators.ts
│   └── types/index.ts
├── supabase/migrations/
│   ├── 001_news_schema.sql
│   ├── 002_property_schema.sql
│   ├── 003_user_schema.sql
│   ├── 004_rls.sql
│   ├── 005_cron.sql
│   ├── 006_schema_updates.sql
│   └── 007_rls_policies.sql
└── .github/workflows/daily-pipeline.yml
```

---

## 4. 환경변수

### `web/.env.local.example`

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# 내부 API 인증 (openssl rand -hex 32)
PIPELINE_API_KEY=your-pipeline-secret-key
ADMIN_API_KEY=your-admin-secret-key

# GitHub (파이프라인 수동 실행)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_REPO=username/부동산

# AI
ANTHROPIC_API_KEY=sk-ant-...

# 카카오 (클라이언트: 지도 / 서버: REST 검색)
NEXT_PUBLIC_KAKAO_MAP_KEY=your-kakao-javascript-app-key
KAKAO_REST_API_KEY=your-kakao-rest-api-key

# Toss Payments (Phase 2)
TOSS_SECRET_KEY=test_sk_...
```

### `pipeline/.env.example`

```env
NAVER_CLIENT_ID=xxxx
NAVER_CLIENT_SECRET=xxxx
MOLIT_API_KEY=xxxx
BOK_API_KEY=xxxx
ANTHROPIC_API_KEY=sk-ant-...
BACKEND_URL=https://your-vercel-domain.vercel.app
PIPELINE_API_KEY=your-pipeline-secret-key
RESEND_API_KEY=re_...
SOLAPI_API_KEY=xxxx
SOLAPI_API_SECRET=xxxx
KAKAO_SENDER_KEY=xxxx
KAKAO_TEMPLATE_URGENT=xxxx
KAKAO_TEMPLATE_PROPERTY=xxxx
KAKAO_REST_API_KEY=xxxx
USER_EMAIL=your@email.com
USER_PHONE=010-0000-0000
USER_REGION=서울 마포구
USER_BUDGET_MIN=30000
USER_BUDGET_MAX=60000
```

---

## 5. Supabase 마이그레이션

### `001_news_schema.sql`

```sql
CREATE TABLE articles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source          text NOT NULL,
  title           text NOT NULL,
  url             text UNIQUE NOT NULL,
  published_at    timestamptz,
  category        text,
  regions         jsonb DEFAULT '[]',
  importance      int CHECK (importance BETWEEN 1 AND 10),
  urgent          boolean DEFAULT false,
  summary         text,
  status          text DEFAULT 'active' CHECK (status IN ('active','hidden','deleted')),
  pipeline_run_id uuid,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_articles_created_at ON articles (created_at DESC);
CREATE INDEX idx_articles_category   ON articles (category);
CREATE INDEX idx_articles_urgent     ON articles (urgent) WHERE urgent = true;
CREATE INDEX idx_articles_status     ON articles (status);

CREATE TABLE pipeline_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at       timestamptz DEFAULT now(),
  finished_at      timestamptz,
  status           text DEFAULT 'running' CHECK (status IN ('running','success','failed')),
  articles_fetched int DEFAULT 0,
  articles_saved   int DEFAULT 0,
  articles_skipped int DEFAULT 0,
  error_message    text,
  sources_summary  jsonb DEFAULT '{}'
);

CREATE TABLE briefings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id  uuid REFERENCES pipeline_runs(id),
  content          text NOT NULL,
  signal           text CHECK (signal IN ('buy','wait','avoid')),
  signal_reason    text,
  articles_count   int DEFAULT 0,
  urgent_count     int DEFAULT 0,
  generated_at     timestamptz DEFAULT now()
);

CREATE INDEX idx_briefings_generated ON briefings (generated_at DESC);
```

### `002_property_schema.sql`

```sql
CREATE TABLE complexes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  sigungu          text,
  dong             text,
  road_address     text,
  lat              decimal(9,6),
  lng              decimal(9,6),
  built_year       int,
  total_units      int,
  builder          text,
  builder_tier     int,
  parking_per_unit decimal(4,2),
  molit_complex_id text UNIQUE,
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_complexes_sigungu ON complexes (sigungu);
CREATE INDEX idx_complexes_name    ON complexes (name);

CREATE TABLE transactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id       uuid REFERENCES complexes(id) ON DELETE CASCADE,
  transaction_date date NOT NULL,
  price            int NOT NULL,
  floor            int,
  area_sqm         decimal(6,2),
  deal_type        text DEFAULT '매매'
);

CREATE INDEX idx_transactions_complex ON transactions (complex_id, transaction_date DESC);

CREATE TABLE properties (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id         uuid REFERENCES complexes(id),
  property_type      text NOT NULL CHECK (property_type IN ('sale','auction','subscription')),
  source             text NOT NULL,
  source_url         text UNIQUE NOT NULL,
  title              text,
  price              int,
  deposit            int,
  floor              int,
  area_sqm           decimal(6,2),
  direction          text,
  auction_date       date,
  auction_court      text,
  bid_count          int DEFAULT 0,
  subscription_start date,
  subscription_end   date,
  move_in_date       date,
  status             text DEFAULT 'active' CHECK (status IN ('active','sold','expired')),
  pipeline_run_id    uuid,
  listed_at          timestamptz,
  created_at         timestamptz DEFAULT now()
);

CREATE INDEX idx_properties_type    ON properties (property_type, status);
CREATE INDEX idx_properties_complex ON properties (complex_id);
CREATE INDEX idx_properties_created ON properties (created_at DESC);

CREATE TABLE location_scores (
  complex_id          uuid PRIMARY KEY REFERENCES complexes(id) ON DELETE CASCADE,
  nearest_subway      text,
  nearest_subway_min  int,
  school_score        int,
  school_count_1km    int,
  convenience_score   int,
  mart_min            int,
  hospital_min        int,
  park_min            int,
  details             jsonb,
  calculated_at       timestamptz DEFAULT now()
);

CREATE TABLE property_scores (
  property_id         uuid PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
  price_score         int,
  location_score      int,
  complex_score       int,
  demand_score        int,
  regulatory_score    int,
  total_score         int,
  pros                jsonb DEFAULT '[]',
  cons                jsonb DEFAULT '[]',
  ai_summary          text,
  personalized_reason text,
  scored_at           timestamptz DEFAULT now()
);

CREATE INDEX idx_property_scores_total ON property_scores (total_score DESC);
```

### `003_user_schema.sql`

```sql
CREATE TABLE user_profiles (
  id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            text NOT NULL,
  name             text,
  phone            text,
  tier             text DEFAULT 'free' CHECK (tier IN ('free','basic','premium')),
  subscription_end timestamptz,
  regions          jsonb DEFAULT '[]',
  budget_min       int DEFAULT 30000,
  budget_max       int DEFAULT 60000,
  email_enabled    boolean DEFAULT true,
  kakao_enabled    boolean DEFAULT false,
  subscription_score int,
  has_dependent    boolean DEFAULT false,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE TABLE subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  tier        text NOT NULL CHECK (tier IN ('basic','premium')),
  amount      int NOT NULL,
  payment_key text,
  status      text DEFAULT 'active' CHECK (status IN ('active','cancelled','expired')),
  started_at  timestamptz DEFAULT now(),
  ended_at    timestamptz,
  created_at  timestamptz DEFAULT now()
);
```

### `004_rls.sql`

```sql
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
-- 기본 공개 읽기 정책 (007에서 전체 정책으로 교체)
CREATE POLICY "articles_public_read" ON articles
  FOR SELECT USING (status = 'active');
```

### `005_cron.sql`

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'cleanup-old-articles',
  '0 18 * * *',   -- UTC 18:00 = KST 03:00
  $$
    UPDATE articles SET status = 'deleted'
    WHERE created_at < now() - INTERVAL '30 days'
      AND status != 'deleted';
  $$
);

SELECT cron.schedule(
  'cleanup-pipeline-runs',
  '30 18 * * *',
  $$
    DELETE FROM pipeline_runs
    WHERE started_at < now() - INTERVAL '90 days';
  $$
);
```

### `006_schema_updates.sql`

> `001_news_schema.sql`을 처음 적용하는 경우 생략 가능 (이미 최신 컬럼 포함)

```sql
ALTER TABLE briefings ADD COLUMN IF NOT EXISTS signal text
  CHECK (signal IN ('buy','wait','avoid'));
ALTER TABLE briefings ADD COLUMN IF NOT EXISTS signal_reason text;
ALTER TABLE briefings ADD COLUMN IF NOT EXISTS articles_count int DEFAULT 0;
ALTER TABLE briefings ADD COLUMN IF NOT EXISTS urgent_count   int DEFAULT 0;
ALTER TABLE property_scores ADD COLUMN IF NOT EXISTS personalized_reason text;
```

### `007_rls_policies.sql`

> `004_rls.sql`의 articles 정책과 중복 주의. 004 적용 후 해당 policy를 DROP하거나 004를 비운 뒤 실행.

```sql
ALTER TABLE articles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties      ENABLE ROW LEVEL SECURITY;
ALTER TABLE complexes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "articles_public_read"     ON articles        FOR SELECT USING (status = 'active');
CREATE POLICY "briefings_public_read"    ON briefings       FOR SELECT USING (true);
CREATE POLICY "properties_public_read"   ON properties      FOR SELECT USING (status = 'active');
CREATE POLICY "complexes_public_read"    ON complexes       FOR SELECT USING (true);
CREATE POLICY "scores_public_read"       ON property_scores FOR SELECT USING (true);
CREATE POLICY "location_public_read"     ON location_scores FOR SELECT USING (true);
CREATE POLICY "transactions_public_read" ON transactions    FOR SELECT USING (true);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_profiles_self" ON user_profiles
  FOR ALL USING (auth.uid() = id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions_self" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);
```

---

## 6. Python 파이프라인

### `pipeline/requirements.txt`

```
httpx==0.27.2
anthropic==0.34.0
playwright==1.47.0
playwright-stealth==1.0.6
feedparser==6.0.11
resend==2.4.0
solapi==4.2.2
pytest==8.3.3
pytest-asyncio==0.24.0
```

### `pipeline/config.py`

```python
import os
from dataclasses import dataclass

@dataclass
class Config:
    naver_client_id: str
    naver_client_secret: str
    molit_api_key: str
    bok_api_key: str
    anthropic_api_key: str
    backend_url: str
    pipeline_api_key: str
    resend_api_key: str
    solapi_api_key: str
    solapi_api_secret: str
    kakao_sender_key: str
    kakao_template_urgent: str
    kakao_template_property: str
    kakao_rest_api_key: str
    user_email: str
    user_phone: str
    user_region: str
    user_budget_min: int
    user_budget_max: int

def load_config() -> Config:
    required = ['NAVER_CLIENT_ID','NAVER_CLIENT_SECRET','MOLIT_API_KEY',
        'ANTHROPIC_API_KEY','BACKEND_URL','PIPELINE_API_KEY','RESEND_API_KEY','USER_EMAIL','USER_PHONE']
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        raise RuntimeError(f'필수 환경변수 누락: {missing}')
    return Config(
        naver_client_id=os.environ['NAVER_CLIENT_ID'],
        naver_client_secret=os.environ['NAVER_CLIENT_SECRET'],
        molit_api_key=os.environ['MOLIT_API_KEY'],
        bok_api_key=os.environ.get('BOK_API_KEY',''),
        anthropic_api_key=os.environ['ANTHROPIC_API_KEY'],
        backend_url=os.environ['BACKEND_URL'].rstrip('/'),
        pipeline_api_key=os.environ['PIPELINE_API_KEY'],
        resend_api_key=os.environ['RESEND_API_KEY'],
        solapi_api_key=os.environ.get('SOLAPI_API_KEY',''),
        solapi_api_secret=os.environ.get('SOLAPI_API_SECRET',''),
        kakao_sender_key=os.environ.get('KAKAO_SENDER_KEY',''),
        kakao_template_urgent=os.environ.get('KAKAO_TEMPLATE_URGENT',''),
        kakao_template_property=os.environ.get('KAKAO_TEMPLATE_PROPERTY',''),
        kakao_rest_api_key=os.environ.get('KAKAO_REST_API_KEY',''),
        user_email=os.environ['USER_EMAIL'],
        user_phone=os.environ['USER_PHONE'],
        user_region=os.environ.get('USER_REGION','서울'),
        user_budget_min=int(os.environ.get('USER_BUDGET_MIN',30000)),
        user_budget_max=int(os.environ.get('USER_BUDGET_MAX',60000)),
    )
```

### `pipeline/crawlers/base.py`

```python
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class RawArticle:
    source: str
    title: str
    url: str
    content: str
    published_at: datetime

@dataclass
class ClassifiedArticle(RawArticle):
    category: str = ""
    regions: list[str] = field(default_factory=list)
    importance: int = 5
    urgent: bool = False
    summary: str = ""
```

### `pipeline/crawlers/naver_news.py`

```python
import httpx
from .base import RawArticle
from datetime import datetime

KEYWORDS = ['생애최초 대출','아파트 매매','청약','금리 인상','재건축','취득세','전세']

async def fetch_naver_news(config) -> list[RawArticle]:
    results = []
    async with httpx.AsyncClient() as client:
        for keyword in KEYWORDS:
            res = await client.get(
                'https://openapi.naver.com/v1/search/news.json',
                params={'query': keyword, 'display': 10, 'sort': 'date'},
                headers={'X-Naver-Client-Id': config.naver_client_id,
                         'X-Naver-Client-Secret': config.naver_client_secret},
                timeout=10,
            )
            res.raise_for_status()
            for item in res.json().get('items', []):
                results.append(RawArticle(
                    source='naver',
                    title=item['title'].replace('<b>','').replace('</b>',''),
                    url=item['originallink'] or item['link'],
                    content=item['description'].replace('<b>','').replace('</b>',''),
                    published_at=datetime.strptime(item['pubDate'], '%a, %d %b %Y %H:%M:%S +0900'),
                ))
    return results
```

### `pipeline/crawlers/rss.py`

```python
import httpx
from xml.etree import ElementTree
from datetime import datetime
from .base import RawArticle

RSS_FEEDS = [
    ('https://www.mk.co.kr/rss/30000001/', 'mk'),
    ('https://biz.chosun.com/site/data/rss/realestate.xml', 'chosun'),
]

async def fetch_rss(config) -> list[RawArticle]:
    results = []
    async with httpx.AsyncClient(timeout=10) as client:
        for url, source in RSS_FEEDS:
            try:
                res  = await client.get(url)
                root = ElementTree.fromstring(res.text)
                for item in root.findall('.//item')[:10]:
                    title = item.findtext('title','').strip()
                    link  = item.findtext('link','').strip()
                    desc  = item.findtext('description','').strip()
                    try:
                        pub = datetime.strptime(item.findtext('pubDate',''), '%a, %d %b %Y %H:%M:%S +0900')
                    except ValueError:
                        pub = datetime.now()
                    results.append(RawArticle(source=source, title=title, url=link,
                        content=desc[:2000], published_at=pub))
            except Exception:
                pass
    return results
```

### `pipeline/crawlers/public_apis.py`

```python
import httpx
from datetime import datetime, date
from .base import RawArticle

async def fetch_molit_transactions(config) -> list[RawArticle]:
    ym  = date.today().strftime('%Y%m')
    url = 'http://openapi.molit.go.kr/OpenAPI_ToolInstallPackage/service/rest/RTMSOBJSvc/getRTMSDataSvcAptTradeDev'
    results = []
    for lawdCd in ['11110','11140','11170','11200','11215','11230','11260','11290','11305','11320']:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                res = await client.get(url, params={
                    'serviceKey': config.molit_api_key, 'LAWD_CD': lawdCd,
                    'DEAL_YMD': ym, 'numOfRows': 10, 'pageNo': 1,
                })
            items = res.json().get('response',{}).get('body',{}).get('items',{}).get('item',[])
            if isinstance(items, dict): items = [items]
            for item in items[:3]:
                t = f'[실거래] {item.get("법정동","")} {item.get("아파트","")} {item.get("전용면적","")}m2 {item.get("거래금액","").replace(",","")}만원 ({item.get("층","")}층)'
                results.append(RawArticle(source='molit', title=t,
                    url=f'https://rt.molit.go.kr/pt/xif/xifNtbDir.do?lawdCd={lawdCd}&ym={ym}',
                    content=t, published_at=datetime.now()))
        except Exception:
            pass
    return results

async def fetch_bok_rate(config) -> list[RawArticle]:
    ym  = date.today().strftime('%Y%m')
    url = f'https://ecos.bok.or.kr/api/StatisticSearch/{config.bok_api_key}/json/kr/1/5/722Y001/D/{ym}01/{ym}31/0000000'
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(url)
        rows = res.json().get('StatisticSearch',{}).get('row',[])
        if not rows: return []
        latest = rows[-1]
        t = f'[한은] 기준금리 {latest.get("DATA_VALUE","")}% ({latest.get("TIME","")})'
        return [RawArticle(source='bok', title=t,
            url='https://www.bok.or.kr/portal/main/contents.do?menuNo=200656',
            content=t, published_at=datetime.now())]
    except Exception:
        return []

async def fetch_subscriptions(config) -> list[RawArticle]:
    url = 'https://www.apt2you.com/api/notice/noticeList'
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(url, params={'pageIndex':1,'pageSize':5,'noticeGbn':'01'})
        results = []
        for item in res.json().get('list',[]):
            t = f'[청약] {item.get("houseNm","")} {item.get("hssplyAdres","")} ({item.get("rcritPblancDe","")}~{item.get("subscrptRceptEndde","")})'
            results.append(RawArticle(source='subscription', title=t,
                url=f'https://www.apt2you.com/notice/{item.get("pblancNo","")}',
                content=t, published_at=datetime.now()))
        return results
    except Exception:
        return []
```

### `pipeline/crawlers/court_auction.py`

```python
from datetime import datetime
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async
from .base import RawArticle

async def fetch_court_auctions(config) -> list[RawArticle]:
    results = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        page    = await browser.new_page()
        await stealth_async(page)
        try:
            await page.goto('https://www.courtauction.go.kr/RetrieveRealEstList.laf',
                wait_until='networkidle', timeout=30000)
            await page.wait_for_selector('table', timeout=10000)
            for row in (await page.query_selector_all('table tbody tr'))[:10]:
                cells = await row.query_selector_all('td')
                if len(cells) < 5: continue
                texts = [await c.inner_text() for c in cells]
                t   = f'[경매] {texts[2].strip()} 최저가 {texts[4].strip()}'
                url = 'https://www.courtauction.go.kr'
                link = await row.query_selector('a')
                if link:
                    href = await link.get_attribute('href')
                    if href: url = f'https://www.courtauction.go.kr{href}'
                results.append(RawArticle(source='court_auction', title=t,
                    url=url, content=t, published_at=datetime.now()))
        except Exception:
            pass
        finally:
            await browser.close()
    return results
```

### `pipeline/processors/dedup.py`

```python
from crawlers.base import RawArticle

KEYWORDS = ['아파트','주택','부동산','청약','전세','매매','경매','재건축',
            '재개발','금리','대출','취득세','양도세','분양','임대','LTV','DSR']

def deduplicate(articles: list[RawArticle]) -> list[RawArticle]:
    seen: set[str] = set()
    result = []
    for a in articles:
        if a.url not in seen:
            seen.add(a.url)
            result.append(a)
    return result

def filter_real_estate(articles: list[RawArticle]) -> list[RawArticle]:
    return [a for a in articles if any(kw in (a.title + a.content).lower() for kw in KEYWORDS)]
```

### `pipeline/processors/classifier.py`

```python
import json, asyncio
from anthropic import AsyncAnthropic
from crawlers.base import RawArticle, ClassifiedArticle

BATCH_SIZE = 10
PROMPT = """다음 부동산 기사 목록을 분석하고 JSON 배열로만 응답 (설명 없이).

기사 목록:
{articles_json}

각 기사에 대해:
[{{"index":0,"category":"정책|금리|시세|청약|세금|경매|재개발|기타","regions":["서울 마포구"],"importance":1-10,"urgent":true,"summary":"3줄 요약"}}]

urgent=true: 정책 당일시행 D-3이내, 금리 0.5%p이상 변동, 긴급청약/줍줍"""

async def classify_articles(articles: list[RawArticle], anthropic_api_key: str) -> list[ClassifiedArticle]:
    client  = AsyncAnthropic(api_key=anthropic_api_key)
    batches = [articles[i:i+BATCH_SIZE] for i in range(0, len(articles), BATCH_SIZE)]
    sem     = asyncio.Semaphore(3)
    results: list[ClassifiedArticle] = []

    async def classify_batch(batch):
        async with sem:
            aj = json.dumps([{'index':i,'title':a.title,'content':a.content[:500]}
                              for i, a in enumerate(batch)], ensure_ascii=False)
            try:
                msg   = await client.messages.create(model='claude-haiku-4-5', max_tokens=2048,
                    messages=[{'role':'user','content': PROMPT.format(articles_json=aj)}])
                items = json.loads(msg.content[0].text)
                return [ClassifiedArticle(
                    source=batch[it['index']].source, title=batch[it['index']].title,
                    url=batch[it['index']].url, content=batch[it['index']].content,
                    published_at=batch[it['index']].published_at,
                    category=it.get('category','기타'), regions=it.get('regions',[]),
                    importance=it.get('importance',5), urgent=it.get('urgent',False),
                    summary=it.get('summary',''),
                ) for it in items]
            except Exception:
                return []

    for b in await asyncio.gather(*[classify_batch(b) for b in batches]):
        results.extend(b)
    return results
```

### `pipeline/processors/briefing_generator.py`

```python
import json, anthropic as sdk

async def generate_briefing(articles: list, anthropic_api_key: str) -> dict:
    client = sdk.AsyncAnthropic(api_key=anthropic_api_key)
    urgent = [a for a in articles if a.get('urgent')]
    top    = sorted(articles, key=lambda x: x.get('importance',0), reverse=True)[:15]

    prompt = f"""당신은 신혼부부 생애최초 주택구매를 돕는 AI 어드바이저입니다.
오늘의 부동산 뉴스를 분석해 아래 JSON 형식으로만 응답하세요:

뉴스 {len(top)}건 (긴급 {len(urgent)}건):
{chr(10).join(f'- [{a.get("importance",5)}/10] {a["title"]}' for a in top)}

{{"content":"200자 내외 브리핑. 핵심 3가지 + 생애최초 구매자 영향.","signal":"buy|wait|avoid","signal_reason":"신호 판단 근거 1~2줄"}}

signal: buy=금리인하+규제완화+시장안정 동시, avoid=금리인상+규제강화+시장불안 동시, wait=그 외"""

    msg = await client.messages.create(model='claude-haiku-4-5', max_tokens=512,
        messages=[{'role':'user','content': prompt}])
    result = json.loads(msg.content[0].text)
    return {'content': result.get('content',''), 'signal': result.get('signal','wait'),
            'signal_reason': result.get('signal_reason','')}
```

### `pipeline/processors/property_scorer.py`

```python
import json, asyncio, anthropic

async def score_properties(raw_list: list[dict], anthropic_api_key: str,
                            user_region: str = '', user_budget_max: int = 60000) -> list[dict]:
    client = anthropic.AsyncAnthropic(api_key=anthropic_api_key)
    sem    = asyncio.Semaphore(3)

    async def score_one(prop: dict):
        async with sem:
            try:
                msg = await client.messages.create(model='claude-haiku-4-5', max_tokens=512,
                    messages=[{'role':'user','content':
                        f'부동산 매물 분석 후 JSON만 응답:\n매물: {prop}\n사용자: 관심지역={user_region}, 예산최대={user_budget_max}만원\n{{"price_score":0-20,"location_score":0-25,"complex_score":0-20,"demand_score":0-20,"regulatory_score":0-15,"pros":["장점"],"cons":["단점"],"ai_summary":"2줄 요약","personalized_reason":"맞춤 이유 1줄"}}'}])
                result = json.loads(msg.content[0].text)
                total  = sum(result.get(k,0) for k in ['price_score','location_score','complex_score','demand_score','regulatory_score'])
                return {**prop, **result, 'total_score': total}
            except Exception:
                return None

    scored = await asyncio.gather(*[score_one(p) for p in raw_list])
    return [s for s in scored if s is not None]
```

### `pipeline/processors/location_analyzer.py`

```python
import asyncio, httpx

async def fetch_location_score(lat: float, lng: float, kakao_rest_api_key: str) -> dict:
    headers = {'Authorization': f'KakaoAK {kakao_rest_api_key}'}
    base    = 'https://dapi.kakao.com/v2/local/search/keyword.json'
    cats    = [('SW8','subway'),('SC4','school'),('MT1','mart'),('HP8','hospital'),('PK6','park')]

    async def search(code, label):
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(base, headers=headers,
                params={'category_group_code': code, 'x': str(lng), 'y': str(lat), 'radius': 2000, 'size': 5})
            res.raise_for_status()
            return label, res.json().get('documents',[])

    results = await asyncio.gather(*[search(c,l) for c,l in cats], return_exceptions=True)
    data: dict = {l:[] for _,l in cats}
    for r in results:
        if not isinstance(r, Exception):
            label, docs = r
            data[label] = docs

    def d2m(d):
        try: return max(1, round(int(d)/70))
        except: return None

    subway = data.get('subway',[])
    schools = [s for s in data.get('school',[]) if int(s.get('distance',9999)) <= 1000]
    mart    = data.get('mart',[])
    hosp    = data.get('hospital',[])
    park    = data.get('park',[])
    mart_m  = d2m(mart[0].get('distance')) if mart else None
    hosp_m  = d2m(hosp[0].get('distance')) if hosp else None
    park_m  = d2m(park[0].get('distance')) if park else None
    items   = [x for x in [mart_m, hosp_m, park_m] if x is not None]

    return {
        'nearest_subway':     subway[0]['place_name'] if subway else '',
        'nearest_subway_min': d2m(subway[0].get('distance')) if subway else None,
        'school_score':       min(100, len(schools)*25),
        'school_count_1km':   len(schools),
        'convenience_score':  max(0, 100 - int(sum(items)/len(items))) if items else 50,
        'mart_min': mart_m, 'hospital_min': hosp_m, 'park_min': park_m,
    }
```

### `pipeline/notifiers/email.py`

```python
import resend
from datetime import date

SIGNAL_LABEL = {'buy':'🔴 매수 적기','wait':'🟡 관망','avoid':'🔵 매수 자제'}

async def send_briefing_email(config, content: str, signal: str | None = None) -> None:
    resend.api_key  = config.resend_api_key
    today           = date.today().strftime('%Y년 %m월 %d일')
    signal_html     = f'<p style="font-size:18px;font-weight:bold">{SIGNAL_LABEL.get(signal,"")}</p>' if signal else ''
    html = f"""<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
  <h1 style="font-size:22px;margin:0 0 8px">🏠 {today} 부동산 브리핑</h1>
  {signal_html}
  <div style="background:#f8fafc;border-radius:8px;padding:16px;line-height:1.7;white-space:pre-wrap">{content}</div>
  <p style="color:#888;font-size:12px;margin-top:24px">부동산AI — 신혼부부 맞춤 서비스</p>
</body></html>"""
    resend.Emails.send({'from':'부동산AI <brief@yourdomain.com>','to':config.user_email,
        'subject':f'[부동산AI] {today} 부동산 브리핑','html':html})
```

### `pipeline/notifiers/kakao.py`

```python
async def send_urgent_alert(config, articles: list[dict]) -> None:
    if not articles or not config.kakao_template_urgent: return
    lines = '\n'.join(f'• {a.get("title","")[:40]}' for a in articles[:3])
    import solapi
    c = solapi.SolapiMessageService(config.solapi_api_key, config.solapi_api_secret)
    c.send_one({'type':'ATA','to':config.user_phone,'from':config.kakao_sender_key,
        'kakaoOptions':{'pfId':config.kakao_sender_key,'templateId':config.kakao_template_urgent,
        'variables':{'#{긴급뉴스}':lines}}})

async def send_property_alert(config, properties: list[dict]) -> None:
    if not properties: return
    body = '\n'.join(f'• {p.get("complex_name","매물")} | {p.get("price","?")}만원 | AI {p.get("total_score","?")}점'
        for p in properties[:3])
    if not config.kakao_template_property:
        import resend
        resend.api_key = config.resend_api_key
        resend.Emails.send({'from':'부동산AI <brief@yourdomain.com>','to':config.user_email,
            'subject':'[부동산AI] 추천 매물','html':f'<pre>{body}</pre>'})
        return
    import solapi
    c = solapi.SolapiMessageService(config.solapi_api_key, config.solapi_api_secret)
    c.send_one({'type':'ATA','to':config.user_phone,'from':config.kakao_sender_key,
        'kakaoOptions':{'pfId':config.kakao_sender_key,'templateId':config.kakao_template_property,
        'variables':{'#{매물목록}':body}}})
```

### `pipeline/notifiers/alert_failure.py`

```python
import os, resend

def send_failure_alert():
    resend.api_key = os.environ['RESEND_API_KEY']
    run_id = os.environ.get('GITHUB_RUN_ID','unknown')
    repo   = os.environ.get('GITHUB_REPOSITORY','')
    url    = f'https://github.com/{repo}/actions/runs/{run_id}' if repo else '#'
    resend.Emails.send({'from':'부동산AI <alert@yourdomain.com>','to':os.environ['USER_EMAIL'],
        'subject':'⚠️ 부동산AI 파이프라인 실패',
        'html':f'<p>파이프라인 실패. <a href="{url}">로그 확인</a></p>'})

if __name__ == '__main__':
    send_failure_alert()
```

### `pipeline/client.py`

```python
import asyncio, httpx, logging
from config import Config

logger = logging.getLogger(__name__)

class BackendClient:
    def __init__(self, config: Config):
        self.base_url = config.backend_url
        self.headers  = {'X-Pipeline-Key': config.pipeline_api_key, 'Content-Type': 'application/json'}

    async def _post(self, path: str, body: dict, retries: int = 3) -> dict:
        url = f'{self.base_url}{path}'
        for attempt in range(retries):
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    res = await client.post(url, json=body, headers=self.headers)
                    res.raise_for_status()
                    return res.json()
            except (httpx.HTTPStatusError, httpx.RequestError) as e:
                if attempt == retries - 1: raise
                await asyncio.sleep(2 ** attempt)
        return {}

    async def start_run(self) -> str:
        return (await self._post('/api/pipeline/run/start', {}))['run_id']

    async def finish_run(self, run_id: str, status: str, articles_fetched: int = 0,
                          articles_saved: int = 0, articles_skipped: int = 0,
                          error_message: str | None = None) -> None:
        await self._post('/api/pipeline/run/finish', {
            'run_id': run_id, 'status': status,
            'articles_fetched': articles_fetched, 'articles_saved': articles_saved,
            'articles_skipped': articles_skipped, 'error_message': error_message,
        })

    async def ingest_articles(self, run_id: str, articles: list[dict]) -> dict:
        return await self._post('/api/pipeline/ingest', {'run_id': run_id, 'articles': articles})

    async def save_briefing(self, run_id: str, content: str, signal: str,
                             signal_reason: str, articles_count: int, urgent_count: int) -> None:
        await self._post('/api/pipeline/briefing', {
            'run_id': run_id, 'content': content, 'signal': signal,
            'signal_reason': signal_reason, 'articles_count': articles_count,
            'urgent_count': urgent_count,
        })

    async def ingest_properties(self, run_id: str, properties: list[dict]) -> dict:
        return await self._post('/api/pipeline/properties/ingest',
                                 {'run_id': run_id, 'properties': properties})
```

### `pipeline/main.py`

```python
import asyncio, logging
from config import load_config
from client import BackendClient
from crawlers.naver_news import fetch_naver_news
from crawlers.public_apis import fetch_molit_transactions, fetch_bok_rate, fetch_subscriptions
from crawlers.rss import fetch_rss
from crawlers.onbid import fetch_onbid
from crawlers.court_auction import fetch_court_auctions
from processors.dedup import deduplicate, filter_real_estate
from processors.classifier import classify_articles
from processors.briefing_generator import generate_briefing
from processors.property_scorer import score_properties
from notifiers.email import send_briefing_email
from notifiers.kakao import send_urgent_alert, send_property_alert

logger = logging.getLogger(__name__)

async def crawl_all_sources(config) -> list:
    results = await asyncio.gather(
        fetch_naver_news(config), fetch_molit_transactions(config),
        fetch_bok_rate(config), fetch_subscriptions(config),
        fetch_rss(config), fetch_onbid(config), fetch_court_auctions(config),
        return_exceptions=True,
    )
    articles = []
    for r in results:
        if isinstance(r, Exception): logger.warning(f'크롤러 실패: {r}')
        elif r: articles.extend(r)
    return articles

async def process_properties(config, backend, run_id) -> list[dict]:
    raw = await asyncio.gather(fetch_onbid(config), fetch_court_auctions(config),
        fetch_subscriptions(config), return_exceptions=True)
    all_props = []
    for r in raw:
        if not isinstance(r, Exception) and r:
            all_props.extend([{'raw': p} for p in r])
    if not all_props: return []
    scored = await score_properties(all_props, config.anthropic_api_key,
                                     config.user_region, config.user_budget_max)
    try: await backend.ingest_properties(run_id=run_id, properties=scored)
    except Exception as e: logger.warning(f'매물 저장 실패: {e}')
    return scored

async def main():
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    config  = load_config()
    backend = BackendClient(config)
    run_id  = await backend.start_run()
    logger.info(f'파이프라인 시작: run_id={run_id}')
    fetched = saved = skipped = 0
    try:
        raw        = await crawl_all_sources(config)
        fetched    = len(raw)
        filtered   = filter_real_estate(deduplicate(raw))
        skipped    = fetched - len(filtered)
        classified = await classify_articles(filtered, config.anthropic_api_key)
        result     = await backend.ingest_articles(run_id=run_id, articles=[c.__dict__ for c in classified])
        saved      = result.get('saved', 0)
        scored_props, briefing = await asyncio.gather(
            process_properties(config, backend, run_id),
            generate_briefing([c.__dict__ for c in classified], config.anthropic_api_key),
        )
        await backend.save_briefing(run_id=run_id, content=briefing['content'],
            signal=briefing['signal'], signal_reason=briefing.get('signal_reason',''),
            articles_count=len(classified),
            urgent_count=sum(1 for c in classified if getattr(c,'urgent',False)))
        await send_briefing_email(config, briefing['content'], signal=briefing['signal'])
        urgent = [c.__dict__ for c in classified if getattr(c,'urgent',False)]
        if urgent: await send_urgent_alert(config, urgent)
        top = sorted(scored_props, key=lambda x: x.get('total_score',0), reverse=True)[:3]
        if top: await send_property_alert(config, top)
        await backend.finish_run(run_id=run_id, status='success',
            articles_fetched=fetched, articles_saved=saved, articles_skipped=skipped)
        logger.info('파이프라인 완료')
    except Exception as e:
        logger.error(f'파이프라인 실패: {e}', exc_info=True)
        await backend.finish_run(run_id=run_id, status='failed', error_message=str(e))
        raise

if __name__ == '__main__':
    asyncio.run(main())
```

### `.github/workflows/daily-pipeline.yml`

```yaml
name: Daily Real Estate Pipeline
on:
  schedule:
    - cron: '0 21 * * *'
  workflow_dispatch:
jobs:
  run-pipeline:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12', cache: 'pip' }
      - run: pip install -r pipeline/requirements.txt
      - run: playwright install chromium --with-deps
      - name: Run pipeline
        env:
          NAVER_CLIENT_ID:         ${{ secrets.NAVER_CLIENT_ID }}
          NAVER_CLIENT_SECRET:     ${{ secrets.NAVER_CLIENT_SECRET }}
          MOLIT_API_KEY:           ${{ secrets.MOLIT_API_KEY }}
          BOK_API_KEY:             ${{ secrets.BOK_API_KEY }}
          ANTHROPIC_API_KEY:       ${{ secrets.ANTHROPIC_API_KEY }}
          BACKEND_URL:             ${{ secrets.BACKEND_URL }}
          PIPELINE_API_KEY:        ${{ secrets.PIPELINE_API_KEY }}
          RESEND_API_KEY:          ${{ secrets.RESEND_API_KEY }}
          SOLAPI_API_KEY:          ${{ secrets.SOLAPI_API_KEY }}
          SOLAPI_API_SECRET:       ${{ secrets.SOLAPI_API_SECRET }}
          KAKAO_SENDER_KEY:        ${{ secrets.KAKAO_SENDER_KEY }}
          KAKAO_TEMPLATE_URGENT:   ${{ secrets.KAKAO_TEMPLATE_URGENT }}
          KAKAO_TEMPLATE_PROPERTY: ${{ secrets.KAKAO_TEMPLATE_PROPERTY }}
          KAKAO_REST_API_KEY:      ${{ secrets.KAKAO_REST_API_KEY }}
          USER_EMAIL:              ${{ secrets.USER_EMAIL }}
          USER_PHONE:              ${{ secrets.USER_PHONE }}
          USER_REGION:             ${{ secrets.USER_REGION }}
          USER_BUDGET_MIN:         ${{ secrets.USER_BUDGET_MIN }}
          USER_BUDGET_MAX:         ${{ secrets.USER_BUDGET_MAX }}
          GITHUB_RUN_ID:           ${{ github.run_id }}
          GITHUB_REPOSITORY:       ${{ github.repository }}
        run: python pipeline/main.py
      - name: Notify on failure
        if: failure()
        env:
          RESEND_API_KEY:    ${{ secrets.RESEND_API_KEY }}
          USER_EMAIL:        ${{ secrets.USER_EMAIL }}
          GITHUB_RUN_ID:     ${{ github.run_id }}
          GITHUB_REPOSITORY: ${{ github.repository }}
        run: python pipeline/notifiers/alert_failure.py
```

---

## 7. Next.js 웹앱

### `web/package.json`

```json
{
  "name": "web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "15.3.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@supabase/supabase-js": "^2.46.0",
    "@anthropic-ai/sdk": "^0.34.0",
    "recharts": "^2.13.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5",
    "tailwindcss": "^3.4.0",
    "postcss": "^8",
    "autoprefixer": "^10"
  }
}
```

### `web/next.config.ts`

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'pstatic.net' },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },
}

export default nextConfig
```

### `web/middleware.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'

const WINDOW_MS   = 60_000
const MAX_REQUESTS = 60
const counts = new Map<string, { count: number; reset: number }>()

export function middleware(req: NextRequest) {
  const isPublicApi =
    req.nextUrl.pathname.startsWith('/api/articles') ||
    req.nextUrl.pathname.startsWith('/api/properties') ||
    req.nextUrl.pathname.startsWith('/api/briefing')

  if (!isPublicApi) return NextResponse.next()

  const ip  = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  const now = Date.now()
  const entry = counts.get(ip)

  if (!entry || now > entry.reset) {
    counts.set(ip, { count: 1, reset: now + WINDOW_MS })
    return NextResponse.next()
  }

  entry.count++
  if (entry.count > MAX_REQUESTS) {
    return NextResponse.json({ error: 'too many requests' },
      { status: 429, headers: { 'Retry-After': '60' } })
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/articles/:path*', '/api/properties/:path*', '/api/briefing/:path*'],
}
```

### `web/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

const url     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const svcRole = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function createServerClient() {
  return createClient(url, svcRole, { auth: { persistSession: false } })
}

export function createPublicClient() {
  return createClient(url, anon)
}
```

### `web/lib/auth.ts`

```typescript
import { NextRequest } from 'next/server'

export function validatePipelineKey(req: NextRequest): boolean {
  const key = req.headers.get('x-pipeline-key') ?? ''
  return key !== '' && key === process.env.PIPELINE_API_KEY
}

export function validateAdminKey(req: NextRequest | Request): boolean {
  const key = (req.headers as any).get('x-admin-key') ?? ''
  return key !== '' && key === process.env.ADMIN_API_KEY
}

export function unauthorized(): Response {
  return Response.json({ error: 'unauthorized' }, { status: 401 })
}
```

### `web/lib/validators.ts`

```typescript
import { z } from 'zod'

export const ArticleIngestSchema = z.object({
  run_id:   z.string().uuid(),
  articles: z.array(z.object({
    source:       z.string(),
    title:        z.string().min(1),
    url:          z.string().url(),
    published_at: z.string().optional(),
    category:     z.string().optional(),
    regions:      z.array(z.string()).default([]),
    importance:   z.number().int().min(1).max(10).default(5),
    urgent:       z.boolean().default(false),
    summary:      z.string().optional(),
  })).min(1),
})

export const ArticlePatchSchema = z.object({
  status:     z.enum(['active','hidden','deleted']).optional(),
  category:   z.string().optional(),
  importance: z.number().int().min(1).max(10).optional(),
  urgent:     z.boolean().optional(),
})

export const ArticleQuerySchema = z.object({
  limit:    z.coerce.number().int().min(1).max(100).default(20),
  offset:   z.coerce.number().int().min(0).default(0),
  category: z.string().optional(),
  date:     z.string().optional(),
  urgent:   z.coerce.boolean().optional(),
})
```

### `web/types/index.ts`

```typescript
export type Category = '정책' | '금리' | '시세' | '청약' | '세금' | '경매' | '재개발' | '기타'
export type ArticleStatus = 'active' | 'hidden' | 'deleted'
export type PropertyType = 'sale' | 'auction' | 'subscription'
export type Tier = 'free' | 'basic' | 'premium'
export type BuyingSignal = 'buy' | 'wait' | 'avoid'

export interface Article {
  id: string
  title: string
  url: string
  source: string
  category: Category | null
  summary: string | null
  importance: number
  urgent: boolean
  status: ArticleStatus
  regions: string[]
  published_at: string
  created_at: string
}

export interface Property {
  id: string
  complex_id: string | null
  property_type: PropertyType
  source: string
  source_url: string
  title: string | null
  price: number | null
  floor: number | null
  area_sqm: number | null
  auction_date: string | null
  bid_count: number
  subscription_start: string | null
  subscription_end: string | null
  status: string
  created_at: string
  complexes?: Complex | null
  property_scores?: PropertyScore | null
}

export interface Complex {
  id: string
  name: string
  sigungu: string
  road_address: string | null
  lat: number | null
  lng: number | null
  molit_complex_id: string | null
  location_scores?: LocationScore | null
}

export interface PropertyScore {
  property_id: string
  price_score: number
  location_score: number
  complex_score: number
  demand_score: number
  regulatory_score: number
  total_score: number
  pros: string[]
  cons: string[]
  ai_summary: string | null
  personalized_reason: string | null
  scored_at: string
}

export interface LocationScore {
  complex_id: string
  nearest_subway: string | null
  nearest_subway_min: number | null
  school_score: number
  convenience_score: number
  mart_min: number | null
  hospital_min: number | null
  park_min: number | null
}

export interface Briefing {
  id: string
  content: string
  signal: BuyingSignal | null
  signal_reason?: string | null
  articles_count: number
  urgent_count: number
  generated_at: string
  pipeline_run_id: string | null
}

export interface PipelineRun {
  id: string
  started_at: string
  finished_at: string | null
  status: 'running' | 'success' | 'failed'
  articles_fetched: number | null
  articles_saved: number | null
  articles_skipped: number | null
  error_message: string | null
}
```

---

### API Routes

#### `web/app/api/pipeline/run/start/route.ts`

```typescript
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validatePipelineKey, unauthorized } from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (!validatePipelineKey(req)) return unauthorized()
  const db = createServerClient()
  const { data, error } = await db.from('pipeline_runs').insert({}).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ run_id: data.id, started_at: data.started_at })
}
```

#### `web/app/api/pipeline/run/finish/route.ts`

```typescript
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validatePipelineKey, unauthorized } from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (!validatePipelineKey(req)) return unauthorized()
  const { run_id, status, articles_fetched, articles_saved, articles_skipped, error_message } = await req.json()
  const db = createServerClient()
  const { error } = await db.from('pipeline_runs').update({
    status, articles_fetched, articles_saved, articles_skipped,
    error_message, finished_at: new Date().toISOString(),
  }).eq('id', run_id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
```

#### `web/app/api/pipeline/ingest/route.ts`

```typescript
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validatePipelineKey, unauthorized } from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (!validatePipelineKey(req)) return unauthorized()
  const { run_id, articles } = await req.json()
  if (!Array.isArray(articles) || articles.length === 0)
    return Response.json({ error: 'articles array required' }, { status: 400 })

  const db   = createServerClient()
  const rows = articles.map((a: any) => ({
    source: a.source, title: a.title, url: a.url,
    published_at: a.published_at ?? null, category: a.category ?? null,
    regions: a.regions ?? [], importance: a.importance ?? 5,
    urgent: a.urgent ?? false, summary: a.summary ?? null,
    status: 'active', pipeline_run_id: run_id,
  }))

  const { data, error } = await db.from('articles')
    .upsert(rows, { onConflict: 'url', ignoreDuplicates: true }).select('id')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  const saved   = data?.length ?? 0
  return Response.json({ saved, skipped: articles.length - saved, run_id })
}
```

#### `web/app/api/pipeline/briefing/route.ts`

```typescript
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validatePipelineKey, unauthorized } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function POST(req: NextRequest) {
  if (!validatePipelineKey(req)) return unauthorized()
  const { run_id, content, signal, signal_reason, articles_count, urgent_count } = await req.json()
  const db = createServerClient()
  const { data, error } = await db.from('briefings')
    .insert({ pipeline_run_id: run_id, content, signal, signal_reason, articles_count, urgent_count })
    .select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  revalidatePath('/')
  return Response.json({ briefing: data })
}
```

#### `web/app/api/pipeline/properties/ingest/route.ts`

```typescript
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validatePipelineKey, unauthorized } from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (!validatePipelineKey(req)) return unauthorized()
  const { run_id, properties } = await req.json()
  if (!Array.isArray(properties) || properties.length === 0)
    return Response.json({ error: 'properties array required' }, { status: 400 })

  const db   = createServerClient()
  const rows = properties.map((p: any) => ({
    source: p.source ?? 'unknown', source_url: p.source_url ?? p.url ?? '',
    property_type: p.property_type ?? 'sale', title: p.title ?? null,
    price: p.price ?? null, area_sqm: p.area_sqm ?? null,
    auction_date: p.auction_date ?? null, status: 'active', pipeline_run_id: run_id,
  }))

  const { data, error } = await db.from('properties')
    .upsert(rows, { onConflict: 'source_url', ignoreDuplicates: true }).select('id')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ saved: data?.length ?? 0, run_id })
}
```

#### `web/app/api/briefing/today/route.ts`

```typescript
import { createServerClient } from '@/lib/supabase'

export const revalidate = 3600

export async function GET() {
  const db    = createServerClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await db.from('briefings')
    .select('id, content, signal, signal_reason, articles_count, urgent_count, generated_at, pipeline_run_id')
    .gte('generated_at', `${today}T00:00:00+09:00`)
    .order('generated_at', { ascending: false })
    .limit(1).single()

  if (error || !data) return Response.json({ briefing: null })
  return Response.json({ briefing: data })
}
```

#### `web/app/api/articles/route.ts`

```typescript
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { ArticleQuerySchema } from '@/lib/validators'

export const revalidate = 1800

export async function GET(req: NextRequest) {
  const url    = req.nextUrl
  const parsed = ArticleQuerySchema.safeParse({
    limit:    url.searchParams.get('limit'),
    offset:   url.searchParams.get('offset'),
    category: url.searchParams.get('category'),
    date:     url.searchParams.get('date'),
    urgent:   url.searchParams.get('urgent'),
  })
  if (!parsed.success) return Response.json({ error: 'invalid params' }, { status: 400 })

  const { limit, offset, category, date, urgent } = parsed.data
  const db = createServerClient()
  let query = db.from('articles')
    .select('*', { count: 'exact' })
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (category) query = query.eq('category', category)
  if (date) {
    query = query
      .gte('created_at', `${date}T00:00:00+09:00`)
      .lte('created_at', `${date}T23:59:59+09:00`)
  }
  if (urgent !== undefined) query = query.eq('urgent', urgent)

  const { data, count, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ articles: data, total: count, limit, offset })
}
```

#### `web/app/api/properties/route.ts`

```typescript
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export const revalidate = 1800

export async function GET(req: NextRequest) {
  const url    = req.nextUrl
  const limit  = Math.min(Number(url.searchParams.get('limit') ?? 20), 100)
  const offset = Number(url.searchParams.get('offset') ?? 0)
  const type   = url.searchParams.get('type')
  const sort   = url.searchParams.get('sort') ?? 'created_at'

  const db = createServerClient()
  let query = db.from('properties')
    .select('*, complexes(name,sigungu,lat,lng,location_scores(*)), property_scores(*)', { count: 'exact' })
    .eq('status', 'active')
    .order(sort === 'score' ? 'property_scores.total_score' : 'created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (type) query = query.eq('property_type', type)

  const { data, count, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ properties: data, total: count, limit, offset })
}
```

#### `web/app/api/properties/today-picks/route.ts`

```typescript
import { createServerClient } from '@/lib/supabase'

export const revalidate = 3600

export async function GET() {
  const db    = createServerClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await db.from('properties')
    .select('*, complexes(name,sigungu,lat,lng), property_scores(*)')
    .eq('status', 'active')
    .gte('created_at', `${today}T00:00:00+09:00`)
    .order('property_scores.total_score', { ascending: false })
    .limit(3)
  if (error) return Response.json({ properties: [] })
  return Response.json({ properties: data })
}
```

#### `web/app/api/admin/stats/route.ts`

```typescript
import { createServerClient } from '@/lib/supabase'
import { validateAdminKey, unauthorized } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!validateAdminKey(req as any)) return unauthorized()
  const db    = createServerClient()
  const today = new Date().toISOString().slice(0, 10)

  const [artRes, urgentRes, hiddenRes, runRes] = await Promise.all([
    db.from('articles').select('id', { count: 'exact', head: true })
      .eq('status','active').gte('created_at',`${today}T00:00:00+09:00`),
    db.from('articles').select('id', { count: 'exact', head: true })
      .eq('urgent', true).gte('created_at',`${today}T00:00:00+09:00`),
    db.from('articles').select('id', { count: 'exact', head: true })
      .eq('status','hidden'),
    db.from('pipeline_runs').select('status,started_at,finished_at')
      .order('started_at', { ascending: false }).limit(1).single(),
  ])

  return Response.json({
    articles: {
      today:        artRes.count ?? 0,
      urgent_today: urgentRes.count ?? 0,
      hidden:       hiddenRes.count ?? 0,
    },
    pipeline: {
      last_run_status: runRes.data?.status ?? null,
      last_run_at:     runRes.data?.started_at ?? null,
    },
  })
}
```

#### `web/app/api/admin/pipeline/runs/route.ts`

```typescript
import { createServerClient } from '@/lib/supabase'
import { validateAdminKey, unauthorized } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!validateAdminKey(req as any)) return unauthorized()
  const db = createServerClient()
  const { data, error } = await db.from('pipeline_runs')
    .select('*').order('started_at', { ascending: false }).limit(20)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ runs: data })
}
```

#### `web/app/api/admin/pipeline/trigger/route.ts`

```typescript
import { NextRequest } from 'next/server'
import { validateAdminKey, unauthorized } from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (!validateAdminKey(req)) return unauthorized()
  const githubToken = process.env.GITHUB_TOKEN
  const repo        = process.env.GITHUB_REPO
  if (!githubToken || !repo)
    return Response.json({ error: 'GITHUB_TOKEN or GITHUB_REPO not configured' }, { status: 500 })

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/daily-pipeline.yml/dispatches`,
    { method: 'POST',
      headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json',
                 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: 'main' }) },
  )
  if (!res.ok) return Response.json({ error: `GitHub API error: ${res.status}` }, { status: 502 })
  return Response.json({ triggered: true })
}
```

#### `web/app/api/admin/articles/route.ts`

```typescript
import { createServerClient } from '@/lib/supabase'
import { validateAdminKey, unauthorized } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!validateAdminKey(req as any)) return unauthorized()
  const url    = new URL((req as any).url)
  const limit  = Math.min(Number(url.searchParams.get('limit')  ?? 30), 100)
  const offset = Number(url.searchParams.get('offset') ?? 0)
  const status = url.searchParams.get('status') ?? 'active'
  const date   = url.searchParams.get('date')
  const db = createServerClient()
  let query = db.from('articles')
    .select('*', { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (date) {
    query = query.gte('created_at', `${date}T00:00:00+09:00`).lte('created_at', `${date}T23:59:59+09:00`)
  }
  const { data, count, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ articles: data, total: count, limit, offset })
}
```

#### `web/app/api/admin/articles/[id]/route.ts`

```typescript
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { validateAdminKey, unauthorized } from '@/lib/auth'
import { ArticlePatchSchema } from '@/lib/validators'
import { revalidatePath } from 'next/cache'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!validateAdminKey(req)) return unauthorized()
  const body   = await req.json()
  const parsed = ArticlePatchSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'invalid body' }, { status: 400 })
  const db = createServerClient()
  const { data, error } = await db.from('articles')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', params.id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  revalidatePath('/')
  return Response.json({ article: data })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!validateAdminKey(req)) return unauthorized()
  const db = createServerClient()
  await db.from('articles').update({ status: 'deleted' }).eq('id', params.id)
  revalidatePath('/')
  return Response.json({ ok: true })
}
```

#### `web/app/api/admin/articles/[id]/reclassify/route.ts`

```typescript
import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase'
import { validateAdminKey, unauthorized } from '@/lib/auth'

const anthropic = new Anthropic()

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!validateAdminKey(req)) return unauthorized()
  const db = createServerClient()
  const { data: article } = await db.from('articles')
    .select('title, summary').eq('id', params.id).single()
  if (!article) return Response.json({ error: 'not found' }, { status: 404 })

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5', max_tokens: 256,
    messages: [{ role: 'user', content:
      `부동산 뉴스를 분류하고 JSON으로만 응답. 카테고리: 정책/금리/시세/청약/세금/경매/재개발/기타\n제목: ${article.title}\n내용: ${article.summary ?? ''}\n{"category":"...","importance":1-10,"urgent":true/false,"summary":"한 줄 요약","regions":["서울"]}` }],
  })
  const result = JSON.parse((msg.content[0] as any).text)
  const { data, error } = await db.from('articles')
    .update({ ...result, updated_at: new Date().toISOString() })
    .eq('id', params.id).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ article: data })
}
```

#### `web/app/api/payments/confirm/route.ts`

```typescript
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { paymentKey, orderId, amount, userId, tier } = await req.json()
  const tossSecretKey = process.env.TOSS_SECRET_KEY!
  const encoded = Buffer.from(`${tossSecretKey}:`).toString('base64')

  const res = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  })

  if (!res.ok) {
    const err = await res.json()
    return Response.json({ error: err.message }, { status: 400 })
  }

  const db = createServerClient()
  await db.from('subscriptions').insert({
    user_id: userId, tier, amount, payment_key: paymentKey, status: 'active',
    ended_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  })
  await db.from('user_profiles').update({
    tier,
    subscription_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }).eq('id', userId)

  return Response.json({ ok: true })
}
```

---

## 8. 외부 서비스 발급 가이드

### 8-1. 공공데이터 (국토교통부 실거래가)

1. [공공데이터포털](https://www.data.go.kr) 회원가입
2. "국토교통부 아파트매매 실거래 상세 자료" 검색 → 활용 신청
3. 마이페이지 → 인증키 복사 → `MOLIT_API_KEY`
4. URL: `http://openapi.molit.go.kr/OpenAPI_ToolInstallPackage/service/rest/RTMSOBJSvc/getRTMSDataSvcAptTradeDev`
5. 승인에 1~2일 소요 (자동승인이 아닌 수동 승인)

### 8-2. 한국은행 ECOS (기준금리)

1. [ECOS](https://ecos.bok.or.kr/api/#/) 회원가입 → API 키 발급 (즉시)
2. 통계 코드 `722Y001` = 기준금리 시계열
3. `BOK_API_KEY` 환경변수에 저장

### 8-3. 네이버 뉴스 Search API

1. [네이버 개발자센터](https://developers.naver.com) → 애플리케이션 등록
2. 사용 API: **검색 > 뉴스**
3. 클라이언트 ID, 시크릿 → `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`
4. 제한: 하루 25,000회

### 8-4. 카카오 지도 API

**JavaScript Map API (클라이언트용)**
1. [Kakao Developers](https://developers.kakao.com) → 내 애플리케이션 생성
2. 플랫폼 → Web → 도메인 등록 (로컬: `http://localhost:3000`, 운영: Vercel URL)
3. 앱 키 → JavaScript 키 → `NEXT_PUBLIC_KAKAO_MAP_KEY`

**REST API (서버용 — 장소 검색)**
1. 동일 애플리케이션 → REST API 키
2. 사용 API: 키워드로 장소 검색, 카테고리로 장소 검색
3. `KAKAO_REST_API_KEY`
4. 제한: 하루 300,000회

**카카오 알림톡 (Solapi를 통한 발송)**
1. [Solapi](https://solapi.com) 회원가입 → API 키/시크릿 발급
2. 카카오 채널 연동 → 채널 검색용 키 (`KAKAO_SENDER_KEY`)
3. 알림톡 템플릿 등록 (카카오 비즈센터 심사 필요, 3~5일 소요):
   - 긴급 뉴스 템플릿: `#{긴급뉴스}` 변수 사용
   - 추천 매물 템플릿: `#{매물목록}` 변수 사용
4. 승인 후 Template ID → `KAKAO_TEMPLATE_URGENT`, `KAKAO_TEMPLATE_PROPERTY`

### 8-5. Resend (이메일)

1. [Resend](https://resend.com) 회원가입
2. API Keys → Create API Key → `RESEND_API_KEY`
3. Domains → 도메인 추가 → DNS 레코드 등록 (MX, SPF, DKIM)
4. 무료 플랜: 하루 100건, 월 3,000건 (초기에 충분)

### 8-6. Toss Payments (결제)

1. [토스페이먼츠 개발자센터](https://developers.tosspayments.com) → 가입
2. 테스트 키: 대시보드 → 테스트 → 시크릿 키 복사 → `TOSS_SECRET_KEY`
3. 실결제: 사업자등록 후 심사 통과 필요
4. 웹훅 등록: `POST /api/payments/confirm` (서버에서 결제 최종 확인)

---

## 9. 배포 가이드

### 9-1. Supabase 설정

```bash
# Supabase CLI 설치
npm install -g supabase

# 프로젝트 초기화 (이미 생성된 경우 login 후 link)
supabase login
supabase link --project-ref <프로젝트-ref>

# 마이그레이션 순서대로 실행
supabase db push

# 또는 수동으로 각 SQL 실행:
# Dashboard → SQL Editor에서 001 ~ 007 순서로 붙여넣기
```

**pgBouncer Transaction Mode 설정 (필수)**
- Supabase Dashboard → Settings → Database → Connection Pooling
- Mode: **Transaction**
- Pool Size: **15** (기본 5에서 변경)
- 웹앱에서는 Pooler Connection String 사용 (`port 6543`)
- 직접 연결 (`port 5432`)은 마이그레이션 실행 시에만 사용

**pg_cron 자동 정리 설정**
- Dashboard → Database → Extensions → `pg_cron` 활성화
- SQL Editor에서 실행:

```sql
SELECT cron.schedule(
  'cleanup-old-articles',
  '0 2 * * *',
  $$DELETE FROM articles WHERE created_at < NOW() - INTERVAL '30 days' AND status = 'hidden'$$
);
```

### 9-2. Vercel 배포

```bash
# Vercel CLI
npm install -g vercel

cd web
vercel --prod
```

**환경변수 설정 (Vercel Dashboard → Settings → Environment Variables)**

| 변수명 | 범위 |
|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Production (Server only) |
| `PIPELINE_API_KEY` | Production |
| `ADMIN_API_KEY` | Production |
| `ANTHROPIC_API_KEY` | Production |
| `RESEND_API_KEY` | Production |
| `TOSS_SECRET_KEY` | Production |
| `GITHUB_TOKEN` | Production |
| `GITHUB_REPO` | Production |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | Production, Preview |
| `KAKAO_REST_API_KEY` | Production |

**도메인 연결**
1. Vercel → Settings → Domains → 도메인 추가
2. DNS 레코드를 Vercel이 제공하는 IP로 변경
3. SSL 자동 발급 (Let's Encrypt)

### 9-3. GitHub Actions Secrets 설정

GitHub 리포지토리 → Settings → Secrets and variables → Actions → New repository secret:

| Secret | 설명 |
|--------|------|
| `NAVER_CLIENT_ID` | 네이버 Open API Client ID |
| `NAVER_CLIENT_SECRET` | 네이버 Open API Secret |
| `MOLIT_API_KEY` | 공공데이터 서비스 키 (URL 인코딩 해제 버전) |
| `BOK_API_KEY` | 한국은행 ECOS API 키 |
| `ANTHROPIC_API_KEY` | Claude API 키 |
| `BACKEND_URL` | Vercel 배포 URL (예: `https://yourdomain.com`) |
| `PIPELINE_API_KEY` | 임의 생성 비밀 키 (openssl rand -hex 32) |
| `RESEND_API_KEY` | Resend API 키 |
| `SOLAPI_API_KEY` | Solapi API 키 |
| `SOLAPI_API_SECRET` | Solapi API 시크릿 |
| `KAKAO_SENDER_KEY` | 카카오 채널 검색용 키 |
| `KAKAO_TEMPLATE_URGENT` | 긴급뉴스 알림톡 Template ID |
| `KAKAO_TEMPLATE_PROPERTY` | 추천매물 알림톡 Template ID |
| `KAKAO_REST_API_KEY` | 카카오 REST API 키 |
| `USER_EMAIL` | 브리핑 수신 이메일 |
| `USER_PHONE` | 카카오 알림 수신 전화번호 (010-XXXX-XXXX) |
| `USER_REGION` | 관심 지역 (예: `서울 마포구`) |
| `USER_BUDGET_MIN` | 예산 최솟값 만원 (예: `30000`) |
| `USER_BUDGET_MAX` | 예산 최댓값 만원 (예: `60000`) |

---

## 10. 수익화 모델 (Freemium)

| 기능 | Free | Basic (₩9,900/월) | Premium (₩19,900/월) |
|------|------|-------------------|----------------------|
| 오늘의 브리핑 (요약 3줄) | ✅ | ✅ 전체 | ✅ 전체 |
| BuyingSignal | 마스킹 | ✅ | ✅ |
| 뉴스 목록 | 오늘 3건 | 오늘 전체 | 30일 + 필터 |
| AI 매물 스코어 | 상위 1건 (점수 마스킹) | 상위 3건 | 전체 + 필터링 |
| 지도 시각화 | - | 기본 | 학군/편의시설 레이어 |
| 이메일 알림 | - | 주 1회 | 매일 |
| 카카오 알림 | - | - | 긴급시 즉시 |

**구현 핵심**
- `user_profiles.tier` ('free' | 'basic' | 'premium') 기준으로 API 응답 필터링
- `subscriptions` 테이블에서 `ended_at` 만료 여부로 자동 다운그레이드
- 다운그레이드 로직은 pg_cron 또는 API 요청 시 실시간 체크

---

## 11. 알려진 리스크 & 완화 전략

| 리스크 | 심각도 | 완화 방법 |
|--------|--------|-----------|
| 법원경매 Playwright 차단 | 높음 | playwright-stealth + User-Agent 교체 + 요청 간격 5s |
| MOLIT API 일시 중단 | 중간 | try/except 무시 + 다음날 재시도 |
| Claude Haiku rate limit | 중간 | Semaphore(3) + 배치 처리 + 지수 백오프 |
| pgBouncer 트랜잭션 모드 제약 | 높음 | SET LOCAL 금지, 준비된 구문 금지, Supabase 클라이언트 사용 |
| 마이그레이션 004/007 충돌 | 높음 | 007 실행 전 `DROP POLICY IF EXISTS "articles_public_read" ON articles` |
| Service Role Key 노출 | 매우 높음 | 서버 전용 변수, `NEXT_PUBLIC_` 절대 금지 |
| Vercel Edge 함수 메모리 | 중간 | API Route에서 Supabase 연결은 요청당 생성/소멸 |
| 네이버 API 25,000회/일 초과 | 낮음 | 7개 키워드 × 10건 = 70회/실행 → 여유 충분 |
| 카카오 알림톡 미승인 | 중간 | 미승인 시 Resend 이메일로 fallback 자동 전환 |

---

## 12. 로컬 개발 환경 셋업

```bash
# 1. 레포지토리 클론
git clone https://github.com/yourname/real-estate-ai.git
cd real-estate-ai

# 2. 웹 의존성
cd web
cp .env.local.example .env.local   # 환경변수 채우기
npm install
npm run dev   # http://localhost:3000

# 3. 파이프라인 의존성 (별도 터미널)
cd pipeline
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium

# 4. 파이프라인 수동 실행
python main.py
```

---

## 13. 검증 체크리스트

### DB
- [ ] Supabase Dashboard → Table Editor에서 7개 테이블 확인
- [ ] RLS 정책이 각 테이블에 적용됐는지 확인 (Authentication → Policies)
- [ ] pgBouncer Pooler URL로 연결 확인

### 파이프라인
- [ ] `python main.py` 로컬 실행 성공
- [ ] Supabase `articles` 테이블에 데이터 삽입 확인
- [ ] Supabase `briefings` 테이블에 오늘 브리핑 삽입 확인
- [ ] 이메일 수신 확인

### 웹앱
- [ ] `GET /api/briefing/today` → `{"briefing":{"content":"..."}}` 반환
- [ ] `GET /api/articles?limit=5` → 기사 목록 반환
- [ ] `POST /api/pipeline/ingest` (X-Pipeline-Key 헤더) → `{"saved":N}` 반환
- [ ] `GET /api/admin/stats` (X-Admin-Key 헤더) → 통계 반환
- [ ] Vercel 배포 후 도메인 접속 확인

### 알림
- [ ] Resend 대시보드에서 이메일 발송 이력 확인
- [ ] 긴급 기사 발생 시 카카오 알림톡 수신 확인 (또는 이메일 fallback)

## 14. Next.js 페이지 & 컴포넌트

### `web/app/layout.tsx`

```typescript
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '부동산AI — 신혼부부 맞춤 부동산 어드바이저',
  description: '생애최초 주택 구매를 위한 AI 부동산 뉴스 큐레이션',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
```

### `web/app/page.tsx` (메인 대시보드 — Server Component)

```typescript
import { createServerClient } from '@/lib/supabase'
import BriefingCard from '@/components/BriefingCard'
import ArticleList from '@/components/ArticleList'
import PropertyGrid from '@/components/PropertyGrid'

export const revalidate = 3600

async function getData() {
  const db    = createServerClient()
  const today = new Date().toISOString().slice(0, 10)

  const [briefingRes, articlesRes, propertiesRes] = await Promise.all([
    db.from('briefings')
      .select('id,content,signal,signal_reason,articles_count,urgent_count,generated_at')
      .gte('generated_at', `${today}T00:00:00+09:00`)
      .order('generated_at', { ascending: false }).limit(1).single(),
    db.from('articles')
      .select('id,title,url,source,category,importance,urgent,summary,published_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false }).limit(20),
    db.from('properties')
      .select('id,title,price,property_type,source_url,complexes(name,sigungu),property_scores(total_score,ai_summary)')
      .eq('status', 'active')
      .gte('created_at', `${today}T00:00:00+09:00`)
      .order('property_scores.total_score', { ascending: false }).limit(6),
  ])

  return {
    briefing:   briefingRes.data ?? null,
    articles:   articlesRes.data ?? [],
    properties: propertiesRes.data ?? [],
  }
}

export default async function HomePage() {
  const { briefing, articles, properties } = await getData()

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
      <h1 className="text-2xl font-bold">🏠 부동산AI</h1>
      {briefing
        ? <BriefingCard briefing={briefing} />
        : <p className="text-gray-500">오늘 브리핑이 아직 생성되지 않았습니다.</p>}
      <section>
        <h2 className="text-lg font-semibold mb-4">오늘의 추천 매물</h2>
        <PropertyGrid properties={properties} />
      </section>
      <section>
        <h2 className="text-lg font-semibold mb-4">최신 뉴스</h2>
        <ArticleList articles={articles} />
      </section>
    </main>
  )
}
```

### `web/components/BriefingCard.tsx`

```typescript
import type { Briefing, BuyingSignal } from '@/types'

const SIGNAL_CONFIG: Record<BuyingSignal, { emoji: string; label: string; color: string }> = {
  buy:   { emoji: '🔴', label: '매수 적기',  color: 'bg-red-50 border-red-200 text-red-700' },
  wait:  { emoji: '🟡', label: '관망',       color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
  avoid: { emoji: '🔵', label: '매수 자제',  color: 'bg-blue-50 border-blue-200 text-blue-700' },
}

export default function BriefingCard({ briefing }: { briefing: Briefing }) {
  const signal = briefing.signal ? SIGNAL_CONFIG[briefing.signal] : null
  const date   = new Date(briefing.generated_at).toLocaleDateString('ko-KR',
    { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <article className="rounded-xl border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">{date} 브리핑</h2>
        <span className="text-xs text-gray-400">
          {briefing.articles_count}건 분석 · 긴급 {briefing.urgent_count}건
        </span>
      </div>

      {signal && (
        <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium ${signal.color}`}>
          {signal.emoji} {signal.label}
          {briefing.signal_reason && (
            <span className="font-normal opacity-80">— {briefing.signal_reason}</span>
          )}
        </div>
      )}

      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{briefing.content}</p>
    </article>
  )
}
```

### `web/components/ArticleList.tsx`

```typescript
import type { Article } from '@/types'

const CATEGORY_COLOR: Record<string, string> = {
  정책: 'bg-purple-100 text-purple-700',
  금리: 'bg-red-100 text-red-700',
  시세: 'bg-blue-100 text-blue-700',
  청약: 'bg-green-100 text-green-700',
  세금: 'bg-orange-100 text-orange-700',
  경매: 'bg-yellow-100 text-yellow-700',
  재개발: 'bg-teal-100 text-teal-700',
  기타: 'bg-gray-100 text-gray-600',
}

export default function ArticleList({ articles }: { articles: Article[] }) {
  if (!articles.length) return <p className="text-gray-400">기사가 없습니다.</p>

  return (
    <ul className="divide-y divide-gray-100">
      {articles.map((a) => (
        <li key={a.id} className="py-3 flex items-start gap-3">
          {a.urgent && <span className="shrink-0 text-red-500 text-sm font-bold">긴급</span>}
          <div className="min-w-0 flex-1">
            <a href={a.url} target="_blank" rel="noopener noreferrer"
               className="text-sm font-medium text-gray-900 hover:underline line-clamp-2">
              {a.title}
            </a>
            {a.summary && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.summary}</p>}
            <div className="flex items-center gap-2 mt-1">
              {a.category && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${CATEGORY_COLOR[a.category] ?? CATEGORY_COLOR.기타}`}>
                  {a.category}
                </span>
              )}
              <span className="text-xs text-gray-400">{a.source}</span>
              <span className="text-xs text-gray-400">중요도 {a.importance}/10</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
```

### `web/components/PropertyGrid.tsx`

```typescript
import type { Property } from '@/types'

function PropertyCard({ property }: { property: Property }) {
  const complex = property.complexes
  const score   = property.property_scores
  const type    = { sale: '매매', auction: '경매', subscription: '청약' }[property.property_type] ?? ''

  return (
    <a href={property.source_url} target="_blank" rel="noopener noreferrer"
       className="block rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {complex?.name ?? property.title ?? '매물'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{complex?.sigungu}</p>
        </div>
        {score && (
          <span className="shrink-0 text-base font-bold text-indigo-600">{score.total_score}점</span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-gray-600">
        <span className="px-1.5 py-0.5 rounded bg-gray-100">{type}</span>
        {property.price && <span>{property.price.toLocaleString()}만원</span>}
      </div>
      {score?.ai_summary && (
        <p className="mt-2 text-xs text-gray-500 line-clamp-2">{score.ai_summary}</p>
      )}
    </a>
  )
}

export default function PropertyGrid({ properties }: { properties: Property[] }) {
  if (!properties.length) return <p className="text-gray-400">오늘 분석된 매물이 없습니다.</p>

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {properties.map((p) => <PropertyCard key={p.id} property={p} />)}
    </div>
  )
}
```

### `web/components/KakaoMap.tsx` (클라이언트 컴포넌트)

```typescript
'use client'
import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    kakao: any
  }
}

interface Props {
  lat: number
  lng: number
  name: string
}

export default function KakaoMap({ lat, lng, name }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const script = document.createElement('script')
    script.src   = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&autoload=false`
    script.async = true
    script.onload = () => {
      window.kakao.maps.load(() => {
        if (!containerRef.current) return
        const map = new window.kakao.maps.Map(containerRef.current, {
          center: new window.kakao.maps.LatLng(lat, lng),
          level: 4,
        })
        const marker = new window.kakao.maps.Marker({
          position: new window.kakao.maps.LatLng(lat, lng),
          map,
        })
        const overlay = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(lat, lng),
          content: `<div style="padding:4px 8px;background:#fff;border-radius:4px;border:1px solid #ddd;font-size:12px;margin-top:-40px">${name}</div>`,
          yAnchor: 1,
        })
        overlay.setMap(map)
      })
    }
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [lat, lng, name])

  return <div ref={containerRef} className="w-full h-64 rounded-lg bg-gray-100" />
}
```

### `web/app/admin/page.tsx` (관리자 대시보드)

```typescript
'use client'
import { useState, useEffect } from 'react'

interface Stats {
  articles: { today: number; urgent_today: number; hidden: number }
  pipeline: { last_run_status: string | null; last_run_at: string | null }
}

export default function AdminPage() {
  const [stats,   setStats]   = useState<Stats | null>(null)
  const [adminKey, setAdminKey] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchStats = async (key: string) => {
    const res = await fetch('/api/admin/stats', { headers: { 'X-Admin-Key': key } })
    if (res.ok) setStats(await res.json())
  }

  const triggerPipeline = async () => {
    setLoading(true)
    try {
      await fetch('/api/admin/pipeline/trigger', {
        method: 'POST', headers: { 'X-Admin-Key': adminKey }
      })
      alert('파이프라인 트리거 완료')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-xl font-bold">관리자 대시보드</h1>

      <div className="flex gap-2">
        <input type="password" placeholder="Admin Key" value={adminKey}
          onChange={e => setAdminKey(e.target.value)}
          className="flex-1 border rounded px-3 py-2 text-sm" />
        <button onClick={() => fetchStats(adminKey)}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700">
          조회
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: '오늘 기사', value: stats.articles.today },
            { label: '긴급 기사', value: stats.articles.urgent_today },
            { label: '숨긴 기사', value: stats.articles.hidden },
            { label: '파이프라인', value: stats.pipeline.last_run_status ?? '-' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      <button onClick={triggerPipeline} disabled={loading || !adminKey}
        className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
        {loading ? '실행 중...' : '파이프라인 수동 실행'}
      </button>
    </div>
  )
}
```

### `web/app/globals.css` (최소 스타일)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html {
  -webkit-text-size-adjust: 100%;
}

body {
  @apply bg-white text-gray-900 antialiased;
}
```

### `web/tailwind.config.ts`

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
```

---

*GUIDE.md 끝 — 이 파일은 부동산AI 프로젝트의 단일 구현 기준 문서입니다.*
*계획 원본: `~/.claude/plans/ai-transient-breeze.md`*

## 14. Next.js 페이지 & 컴포넌트

### `web/app/layout.tsx`

```typescript
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '부동산AI — 신혼부부 맞춤 부동산 어드바이저',
  description: '생애최초 주택 구매를 위한 AI 부동산 뉴스 큐레이션',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
```

### `web/app/page.tsx` (메인 대시보드 — Server Component)

```typescript
import { createServerClient } from '@/lib/supabase'
import BriefingCard from '@/components/BriefingCard'
import ArticleList from '@/components/ArticleList'
import PropertyGrid from '@/components/PropertyGrid'

export const revalidate = 3600

async function getData() {
  const db    = createServerClient()
  const today = new Date().toISOString().slice(0, 10)

  const [briefingRes, articlesRes, propertiesRes] = await Promise.all([
    db.from('briefings')
      .select('id,content,signal,signal_reason,articles_count,urgent_count,generated_at')
      .gte('generated_at', `${today}T00:00:00+09:00`)
      .order('generated_at', { ascending: false }).limit(1).single(),
    db.from('articles')
      .select('id,title,url,source,category,importance,urgent,summary,published_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false }).limit(20),
    db.from('properties')
      .select('id,title,price,property_type,source_url,complexes(name,sigungu),property_scores(total_score,ai_summary)')
      .eq('status', 'active')
      .gte('created_at', `${today}T00:00:00+09:00`)
      .order('property_scores.total_score', { ascending: false }).limit(6),
  ])

  return {
    briefing:   briefingRes.data ?? null,
    articles:   articlesRes.data ?? [],
    properties: propertiesRes.data ?? [],
  }
}

export default async function HomePage() {
  const { briefing, articles, properties } = await getData()

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
      <h1 className="text-2xl font-bold">🏠 부동산AI</h1>
      {briefing
        ? <BriefingCard briefing={briefing} />
        : <p className="text-gray-500">오늘 브리핑이 아직 생성되지 않았습니다.</p>}
      <section>
        <h2 className="text-lg font-semibold mb-4">오늘의 추천 매물</h2>
        <PropertyGrid properties={properties} />
      </section>
      <section>
        <h2 className="text-lg font-semibold mb-4">최신 뉴스</h2>
        <ArticleList articles={articles} />
      </section>
    </main>
  )
}
```

### `web/components/BriefingCard.tsx`

```typescript
import type { Briefing, BuyingSignal } from '@/types'

const SIGNAL_CONFIG: Record<BuyingSignal, { emoji: string; label: string; color: string }> = {
  buy:   { emoji: '🔴', label: '매수 적기',  color: 'bg-red-50 border-red-200 text-red-700' },
  wait:  { emoji: '🟡', label: '관망',       color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
  avoid: { emoji: '🔵', label: '매수 자제',  color: 'bg-blue-50 border-blue-200 text-blue-700' },
}

export default function BriefingCard({ briefing }: { briefing: Briefing }) {
  const signal = briefing.signal ? SIGNAL_CONFIG[briefing.signal] : null
  const date   = new Date(briefing.generated_at).toLocaleDateString('ko-KR',
    { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <article className="rounded-xl border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">{date} 브리핑</h2>
        <span className="text-xs text-gray-400">
          {briefing.articles_count}건 분석 · 긴급 {briefing.urgent_count}건
        </span>
      </div>

      {signal && (
        <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium ${signal.color}`}>
          {signal.emoji} {signal.label}
          {briefing.signal_reason && (
            <span className="font-normal opacity-80">— {briefing.signal_reason}</span>
          )}
        </div>
      )}

      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{briefing.content}</p>
    </article>
  )
}
```

### `web/components/ArticleList.tsx`

```typescript
import type { Article } from '@/types'

const CATEGORY_COLOR: Record<string, string> = {
  정책: 'bg-purple-100 text-purple-700',
  금리: 'bg-red-100 text-red-700',
  시세: 'bg-blue-100 text-blue-700',
  청약: 'bg-green-100 text-green-700',
  세금: 'bg-orange-100 text-orange-700',
  경매: 'bg-yellow-100 text-yellow-700',
  재개발: 'bg-teal-100 text-teal-700',
  기타: 'bg-gray-100 text-gray-600',
}

export default function ArticleList({ articles }: { articles: Article[] }) {
  if (!articles.length) return <p className="text-gray-400">기사가 없습니다.</p>

  return (
    <ul className="divide-y divide-gray-100">
      {articles.map((a) => (
        <li key={a.id} className="py-3 flex items-start gap-3">
          {a.urgent && <span className="shrink-0 text-red-500 text-sm font-bold">긴급</span>}
          <div className="min-w-0 flex-1">
            <a href={a.url} target="_blank" rel="noopener noreferrer"
               className="text-sm font-medium text-gray-900 hover:underline line-clamp-2">
              {a.title}
            </a>
            {a.summary && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.summary}</p>}
            <div className="flex items-center gap-2 mt-1">
              {a.category && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${CATEGORY_COLOR[a.category] ?? CATEGORY_COLOR.기타}`}>
                  {a.category}
                </span>
              )}
              <span className="text-xs text-gray-400">{a.source}</span>
              <span className="text-xs text-gray-400">중요도 {a.importance}/10</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
```

### `web/components/PropertyGrid.tsx`

```typescript
import type { Property } from '@/types'

function PropertyCard({ property }: { property: Property }) {
  const complex = property.complexes
  const score   = property.property_scores
  const type    = { sale: '매매', auction: '경매', subscription: '청약' }[property.property_type] ?? ''

  return (
    <a href={property.source_url} target="_blank" rel="noopener noreferrer"
       className="block rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {complex?.name ?? property.title ?? '매물'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{complex?.sigungu}</p>
        </div>
        {score && (
          <span className="shrink-0 text-base font-bold text-indigo-600">{score.total_score}점</span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-gray-600">
        <span className="px-1.5 py-0.5 rounded bg-gray-100">{type}</span>
        {property.price && <span>{property.price.toLocaleString()}만원</span>}
      </div>
      {score?.ai_summary && (
        <p className="mt-2 text-xs text-gray-500 line-clamp-2">{score.ai_summary}</p>
      )}
    </a>
  )
}

export default function PropertyGrid({ properties }: { properties: Property[] }) {
  if (!properties.length) return <p className="text-gray-400">오늘 분석된 매물이 없습니다.</p>

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {properties.map((p) => <PropertyCard key={p.id} property={p} />)}
    </div>
  )
}
```

### `web/components/KakaoMap.tsx` (클라이언트 컴포넌트)

```typescript
'use client'
import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    kakao: any
  }
}

interface Props {
  lat: number
  lng: number
  name: string
}

export default function KakaoMap({ lat, lng, name }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const script = document.createElement('script')
    script.src   = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&autoload=false`
    script.async = true
    script.onload = () => {
      window.kakao.maps.load(() => {
        if (!containerRef.current) return
        const map = new window.kakao.maps.Map(containerRef.current, {
          center: new window.kakao.maps.LatLng(lat, lng),
          level: 4,
        })
        const marker = new window.kakao.maps.Marker({
          position: new window.kakao.maps.LatLng(lat, lng),
          map,
        })
        const overlay = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(lat, lng),
          content: `<div style="padding:4px 8px;background:#fff;border-radius:4px;border:1px solid #ddd;font-size:12px;margin-top:-40px">${name}</div>`,
          yAnchor: 1,
        })
        overlay.setMap(map)
      })
    }
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [lat, lng, name])

  return <div ref={containerRef} className="w-full h-64 rounded-lg bg-gray-100" />
}
```

### `web/app/admin/page.tsx` (관리자 대시보드)

```typescript
'use client'
import { useState, useEffect } from 'react'

interface Stats {
  articles: { today: number; urgent_today: number; hidden: number }
  pipeline: { last_run_status: string | null; last_run_at: string | null }
}

export default function AdminPage() {
  const [stats,   setStats]   = useState<Stats | null>(null)
  const [adminKey, setAdminKey] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchStats = async (key: string) => {
    const res = await fetch('/api/admin/stats', { headers: { 'X-Admin-Key': key } })
    if (res.ok) setStats(await res.json())
  }

  const triggerPipeline = async () => {
    setLoading(true)
    try {
      await fetch('/api/admin/pipeline/trigger', {
        method: 'POST', headers: { 'X-Admin-Key': adminKey }
      })
      alert('파이프라인 트리거 완료')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-xl font-bold">관리자 대시보드</h1>

      <div className="flex gap-2">
        <input type="password" placeholder="Admin Key" value={adminKey}
          onChange={e => setAdminKey(e.target.value)}
          className="flex-1 border rounded px-3 py-2 text-sm" />
        <button onClick={() => fetchStats(adminKey)}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700">
          조회
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: '오늘 기사', value: stats.articles.today },
            { label: '긴급 기사', value: stats.articles.urgent_today },
            { label: '숨긴 기사', value: stats.articles.hidden },
            { label: '파이프라인', value: stats.pipeline.last_run_status ?? '-' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      <button onClick={triggerPipeline} disabled={loading || !adminKey}
        className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
        {loading ? '실행 중...' : '파이프라인 수동 실행'}
      </button>
    </div>
  )
}
```

### `web/app/globals.css` (최소 스타일)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html {
  -webkit-text-size-adjust: 100%;
}

body {
  @apply bg-white text-gray-900 antialiased;
}
```

### `web/tailwind.config.ts`

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
```

---

*GUIDE.md 끝 — 이 파일은 부동산AI 프로젝트의 단일 구현 기준 문서입니다.*
*계획 원본: `~/.claude/plans/ai-transient-breeze.md`*
