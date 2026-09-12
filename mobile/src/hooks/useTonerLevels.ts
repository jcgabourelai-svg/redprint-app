import { useState } from 'react'
import type { TonerLevels } from '../lib/db'

export type TonerState = { [K in keyof TonerLevels]-?: number | null }

/**
 * Estado de captura de niveles de tóner compartido por la captura de
 * lecturas y el registro de campo: fuente única del filtro omit-if-empty
 * que ambas páginas aplican al armar el payload (sin él, cada endpoint
 * recibiría formas distintas ante un cambio en una sola página).
 */
export function useTonerLevels() {
  const [toner, setToner] = useState<TonerState>({ k: null, c: null, m: null, y: null })

  const tonerConValor = Object.fromEntries(
    (Object.entries(toner) as [keyof TonerLevels, number | null][]).filter(([, v]) => v !== null)
  ) as TonerLevels
  const tieneNiveles = Object.keys(tonerConValor).length > 0

  return { toner, setToner, tonerConValor, tieneNiveles }
}
