interface NumInputProps {
  label: string
  value: number
  onChange: (v: number) => void
  placeholder?: string
  unit?: string
  step?: number
  sub?: string
}

export default function NumInput({
  label, value, onChange, placeholder = '0', unit = '만원', step = 100, sub,
}: NumInputProps) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-500 block">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number" value={value || ''} onChange={e => onChange(Number(e.target.value))}
          placeholder={placeholder} step={step} min={0}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
        />
        <span className="text-xs text-gray-400 shrink-0">{unit}</span>
      </div>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  )
}
