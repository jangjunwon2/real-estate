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

export interface Briefing {
  id: string
  content: string
  signal: BuyingSignal | null
  signal_reason?: string | null
  articles_count: number
  urgent_count: number
  generated_at: string
  pipeline_run_id?: string | null
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
