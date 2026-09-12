import type { ChangeEvent } from 'react'

export type TonerTone = 'k' | 'c' | 'm' | 'y'

const TONE_SWATCH: Record<TonerTone, string> = {
  k: 'bg-gray-900',
  c: 'bg-cyan-500',
  m: 'bg-fuchsia-500',
  y: 'bg-yellow-400 border border-yellow-600',
}

const TONE_BG: Record<TonerTone, string> = {
  k: 'bg-gray-800',
  c: 'bg-cyan-600',
  m: 'bg-fuchsia-600',
  y: 'bg-yellow-500',
}

const CHIPS: { label: string; value: number; low?: boolean }[] = [
  { label: '⚠️ Bajo (10)', value: 10, low: true },
  { label: '25', value: 25 },
  { label: '50', value: 50 },
  { label: '75', value: 75 },
  { label: '100', value: 100 },
]

/**
 * Captura del nivel de un tóner (%): chips de afordancia (Bajo=10, 25, 50,
 * 75, 100) + input libre 0-100. Siempre se guarda un número; "Bajo" es solo
 * convención de UI. Se distingue del PrinterColorDot (identidad de la
 * impresora): aquí el color indica el cartucho CMYK capturado.
 */
export default function TonerLevelInput({
  label,
  tone,
  value,
  onChange,
}: {
  label: string
  tone: TonerTone
  value: number | null
  onChange: (v: number | null) => void
}) {
  function handleChip(v: number) {
    onChange(value === v ? null : v)
  }

  function handleInput(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    if (raw.trim() === '') {
      onChange(null)
      return
    }
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isFinite(parsed)) return
    onChange(Math.min(100, Math.max(0, parsed)))
  }

  const low = value !== null && value <= 20

  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <span aria-hidden="true" className={`inline-block h-3 w-3 shrink-0 rounded-sm ${TONE_SWATCH[tone]}`} />
          {label}
          {value !== null && (
            <span
              className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                low ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {value}%
            </span>
          )}
        </span>
        {value !== null && (
          <button type="button" className="text-xs font-semibold text-gray-400" onClick={() => onChange(null)}>
            Limpiar
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {CHIPS.map((chip) => {
          const active = value === chip.value
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => handleChip(chip.value)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                active
                  ? chip.low
                    ? 'bg-red-500 text-white'
                    : `${TONE_BG[tone]} text-white`
                  : chip.low
                    ? 'bg-red-50 text-red-600 active:bg-red-100'
                    : 'bg-gray-100 text-gray-600 active:bg-gray-200'
              }`}
            >
              {chip.label}
            </button>
          )
        })}
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          placeholder="%"
          value={value ?? ''}
          onChange={handleInput}
          aria-label={`Nivel de tóner ${label} (0-100)`}
          className="w-16 rounded-lg border border-gray-300 bg-white px-2 py-1 text-center text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  )
}
