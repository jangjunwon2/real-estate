'use client'
import Link from 'next/link'

const TIERS = [
  {
    name: 'Free',
    price: '무료',
    color: 'border-gray-200',
    badge: '',
    features: [
      '오늘의 브리핑 요약 3줄',
      '뉴스 오늘치 3건',
      'AI 매물 상위 1건 (점수 마스킹)',
      'BuyingSignal 마스킹',
    ],
    unavailable: ['이메일 알림', '카카오 알림', '지도 시각화', '30일 뉴스 아카이브'],
  },
  {
    name: 'Basic',
    price: '₩9,900',
    period: '/월',
    color: 'border-indigo-300',
    badge: '인기',
    features: [
      '오늘의 브리핑 전체',
      'BuyingSignal 🔴🟡🔵 공개',
      '뉴스 오늘치 전체',
      'AI 매물 상위 3건 + 점수 공개',
      '지도 기본 시각화',
      '이메일 알림 주 1회',
    ],
    unavailable: ['카카오 알림', '30일 뉴스 아카이브'],
  },
  {
    name: 'Premium',
    price: '₩19,900',
    period: '/월',
    color: 'border-yellow-400',
    badge: '풀 기능',
    features: [
      'Basic 전체 포함',
      '30일 뉴스 아카이브 + 카테고리 필터',
      'AI 매물 전체 + 필터링',
      '학군/편의시설 레이어 지도',
      '이메일 알림 매일',
      '긴급 뉴스 즉시 카카오 알림',
      '맞춤 매물 추천 (예산·지역 기반)',
    ],
    unavailable: [],
  },
]

export default function PricingPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-12 space-y-10">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">요금제 안내</h1>
        <p className="text-gray-500 text-sm">신혼부부 생애최초 주택 구매에 필요한 정보를 단계별로 제공합니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {TIERS.map(tier => (
          <div
            key={tier.name}
            className={`rounded-xl border-2 p-6 flex flex-col gap-4 ${tier.color}`}
          >
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-bold">{tier.name}</h2>
              {tier.badge && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                  {tier.badge}
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">{tier.price}</span>
              {tier.period && <span className="text-gray-500 text-sm">{tier.period}</span>}
            </div>

            <ul className="space-y-2 flex-1">
              {tier.features.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                  {f}
                </li>
              ))}
              {tier.unavailable.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-400">
                  <span className="mt-0.5 shrink-0">✗</span>
                  {f}
                </li>
              ))}
            </ul>

            {tier.name === 'Free' ? (
              <Link
                href="/"
                className="block text-center py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                시작하기
              </Link>
            ) : (
              <button
                disabled
                className={`py-2 rounded-lg text-sm font-medium opacity-60 cursor-not-allowed ${
                  tier.name === 'Premium'
                    ? 'bg-yellow-400 text-yellow-900'
                    : 'bg-indigo-600 text-white'
                }`}
                title="출시 준비 중입니다"
              >
                출시 예정
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-gray-400">
        부가세 포함 · 월 구독 · 언제든 취소 가능 · 첫 결제는 Toss Payments 처리
      </p>
    </main>
  )
}
