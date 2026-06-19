import { useEffect, useState } from 'react'

/**
 * Devuelve un valor "reboteado": solo se actualiza tras `delayMs` ms sin cambios.
 * Útil para inputs de búsqueda que disparan peticiones al servidor.
 */
export function useDebounce<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
