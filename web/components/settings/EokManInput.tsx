interface EokManInputProps {
  label: string
  value: number // 만원 단위 총액
  onChange: (v: number) => void
  sub?: string
}

export default function EokManInput({ label, value, onChange, sub }: EokManInputProps) {
  const eok = Math.floor(value / 10000)
  const man = value % 10000

  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-500 block">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number" value={eok || ''} onChange={e => onChange(Number(e.target.value) * 10000 + man)}
          placeholder="0" min={0}
          className="w-16 border border-gray-200 rounded-lg px-2.5 py-2 text-sm text-right focus:outline-none focus:border-indigo-400"
        />
        <span className="text-xs text-gray-400 shrink-0">억</span>
        <input
          type="number" value={man || ''} onChange={e => onChange(eok * 10000 + Number(e.target.value))}
          placeholder="0" min={0} max={9999} step={100}
          className="flex-1 border border-gray-200 rounded-lg px-2.5 py-2 text-sm text-right focus:outline-none focus:border-indigo-400"
        />
        <span className="text-xs text-gray-400 shrink-0">만원</span>
      </div>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  )
}
