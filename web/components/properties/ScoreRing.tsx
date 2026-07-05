'use client'
import { useEffect, useState } from 'react'

interface Props {
  score: number
}

function scoreColor(score: number) {
  if (score >= 80) return '#22c55e'
  if (score >= 65) return '#4f46e5'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

function scoreLabel(score: number) {
  if (score >= 80) return '우수'
  if (score >= 65) return '양호'
  if (score >= 50) return '보통'
  return '주의'
}

export default function ScoreRing({ score }: Props) {
  const [drawn, setDrawn] = useState(0)

  useEffect(() => {
    const t = requestAnimationFrame(() => setDrawn(score))
    return () => cancelAnimationFrame(t)
  }, [score])

  const r = 42
  const circumference = 2 * Math.PI * r
  const dashArray = (drawn / 100) * circumference
  const color = scoreColor(score)
  const label = scoreLabel(score)

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width="96" height="96" viewBox="0 0 100 100" aria-label={`AI 점수 ${score}점`}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f3f4f6" strokeWidth="9" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke={color} strokeWidth="9"
          strokeDasharray={`${dashArray} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
        <text x="50" y="44" textAnchor="middle" fontSize="24" fontWeight="800" fill="#111827" fontFamily="system-ui">
          {score}
        </text>
        <text x="50" y="60" textAnchor="middle" fontSize="11" fill={color} fontWeight="600" fontFamily="system-ui">
          {label}
        </text>
      </svg>
      <p className="text-[10px] text-gray-400">/ 100점</p>
    </div>
  )
}
