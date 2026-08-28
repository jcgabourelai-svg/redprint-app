import { cn } from '@/lib/utils'
import { printerColorPalette, redPrintColors } from '@/types/colors'

export interface ColorDotProps {
  color?: string | null
  className?: string
}

/** Punto de identidad de la paleta por impresora; null o key desconocida -> neutral. */
const ColorDot = ({ color, className }: ColorDotProps) => {
  const palette = (color && printerColorPalette[color]) || redPrintColors.neutral

  return (
    <span
      aria-hidden="true"
      className={cn('inline-block h-2 w-2 rounded-full shrink-0', className)}
      style={{ backgroundColor: palette.DEFAULT }}
    />
  )
}

export default ColorDot
