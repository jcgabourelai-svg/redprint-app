import { useNavigate } from 'react-router-dom'

/**
 * Navegación "atrás" sin dejar entradas huérfanas en el historial:
 * - Si hay historial previo en la app, retrocede (pop) `steps` entradas.
 * - Si no lo hay (deep-link / pestaña nueva), hace replace hacia `fallback`
 *   para no sacar al usuario de la app.
 */
export function useGoBack() {
  const navigate = useNavigate()
  return (fallback: string, steps = 1) => {
    const idx = Number(window.history.state?.idx ?? 0)
    if (idx >= steps) {
      navigate(-steps)
    } else {
      navigate(fallback, { replace: true })
    }
  }
}
