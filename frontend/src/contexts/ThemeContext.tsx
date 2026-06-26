import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'

export type Tema = 'claro' | 'oscuro' | 'sistema'

const STORAGE_KEY = 'redprint_config'

interface ThemeContextType {
  tema: Tema
  setTema: (tema: Tema) => void
  resolvedDark: boolean
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function readStoredTema(): Tema {
  if (typeof window === 'undefined') return 'claro'
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      const tema = parsed?.tema
      if (tema === 'claro' || tema === 'oscuro' || tema === 'sistema') {
        return tema
      }
    }
  } catch {
    // ignore
  }
  return 'claro'
}

export function resolveDark(tema: Tema): boolean {
  if (tema === 'oscuro') return true
  if (tema === 'claro') return false
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function persistTema(tema: Tema): void {
  if (typeof window === 'undefined') return
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) : {}
    parsed.tema = tema
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
  } catch (e) {
    console.error('Failed to persist theme:', e)
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTemaState] = useState<Tema>(readStoredTema)
  const [resolvedDark, setResolvedDark] = useState<boolean>(() => resolveDark(readStoredTema()))

  // Aplicar la clase .dark al DOM cuando cambia el tema resuelto
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedDark)
  }, [resolvedDark])

  // Recalcular resolvedDark cuando cambia tema
  useEffect(() => {
    setResolvedDark(resolveDark(tema))
  }, [tema])

  // Suscribirse a cambios del SO cuando el tema es 'sistema'
  useEffect(() => {
    if (tema !== 'sistema') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setResolvedDark(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [tema])

  // Sincronizar entre pestañas (evento storage)
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setTemaState(readStoredTema())
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const setTema = useCallback((nuevoTema: Tema) => {
    setTemaState(nuevoTema)
    persistTema(nuevoTema)
  }, [])

  const value = { tema, setTema, resolvedDark }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
