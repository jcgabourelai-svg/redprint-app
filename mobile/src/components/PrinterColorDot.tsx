import { printerDotStyle } from '../lib/printerColors'

/**
 * Punto de identidad de la paleta por impresora (10px). Key null o
 * desconocida degrada a gris neutro via printerDotStyle; los callers
 * deciden si renderizarlo (normalmente solo cuando existe color).
 */
export default function PrinterColorDot({
  color,
  className = '',
}: {
  color?: string | null
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${className}`}
      style={printerDotStyle(color)}
    />
  )
}
