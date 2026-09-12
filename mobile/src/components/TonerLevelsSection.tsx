import { useState } from 'react'
import TonerLevelInput from './TonerLevelInput'
import type { TonerTone } from './TonerLevelInput'
import type { TonerLevels } from '../lib/db'
import type { TonerState } from '../hooks/useTonerLevels'

// Record<keyof TonerLevels, ...> obliga a que una clave nueva del contrato
// (k/c/m/y) se reflele aquí o el compilador falla — sin silencios.
const ROW_BY_KEY: Record<keyof TonerLevels, { label: string; tone: TonerTone }> = {
  k: { label: 'Negro', tone: 'k' },
  c: { label: 'Cian', tone: 'c' },
  m: { label: 'Magenta', tone: 'm' },
  y: { label: 'Amarillo', tone: 'y' },
}

export const TONER_ROWS = (Object.keys(ROW_BY_KEY) as (keyof TonerLevels)[]).map((key) => ({
  key,
  label: ROW_BY_KEY[key].label,
  tone: ROW_BY_KEY[key].tone,
}))

export function TonerLevelsSummary({ levels }: { levels: TonerLevels }) {
  const rows = TONER_ROWS.filter((r) => levels[r.key] != null)
  if (rows.length === 0) return null
  return (
    <p className="flex flex-wrap gap-1.5">
      {rows.map((r) => {
        const v = levels[r.key] as number
        return (
          <span
            key={r.key}
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              v <= 20 ? 'bg-red-50 text-red-700' : 'bg-white/80 text-emerald-900'
            }`}
          >
            {r.label} {v}%
          </span>
        )
      })}
    </p>
  )
}

/**
 * Sección colapsable "Nivel de tóner (%)" compartida por la captura de
 * lecturas (esColor conocido del catálogo) y el registro de campo (nunca
 * conocido: siempre disclosure manual).
 */
export default function TonerLevelsSection({
  esColor = false,
  disclosureLabel = '+ Es de color',
  toner,
  onChange,
}: {
  esColor?: boolean
  disclosureLabel?: string
  toner: TonerState
  onChange: (t: TonerState) => void
}) {
  const [open, setOpen] = useState(false)
  const [showColors, setShowColors] = useState(false)
  const colorRowsVisible = esColor || showColors

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3.5 py-3 text-left"
      >
        <span className="text-sm font-semibold text-gray-800">Nivel de tóner (%)</span>
        <span className="text-xs font-medium text-gray-400">
          {open ? 'Ocultar ▲' : 'Opcional ▼'}
        </span>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-3.5 pb-3 pt-3">
          <p className="mb-2 text-xs text-gray-400">
            Porcentaje estimado que muestra el panel de la impresora. Solo informativo.
          </p>
          {TONER_ROWS.filter((r) => r.key === 'k' || colorRowsVisible).map((r) => (
            <TonerLevelInput
              key={r.key}
              label={r.label}
              tone={r.tone}
              value={toner[r.key]}
              onChange={(v) => onChange({ ...toner, [r.key]: v })}
            />
          ))}
          {!colorRowsVisible && (
            <button
              type="button"
              className="text-xs font-semibold text-blue-600"
              onClick={() => setShowColors(true)}
            >
              {disclosureLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
