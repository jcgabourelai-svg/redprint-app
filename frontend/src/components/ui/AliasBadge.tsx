import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { printerColorPalette, redPrintColors } from '@/types/colors'
import ColorDot from '@/components/ui/ColorDot'

export interface AliasBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  alias: string
  color?: string | null
}

/**
 * Identidad del "puesto" que la impresora ocupa en el contrato (alias +
 * pista de color). Estilo punto + fondo pastel + texto oscuro: a diferencia
 * de los badges de estado (solidos), este NO compite semanticamente con
 * rojo=error. Color null o key desconocida -> neutral.
 */
const AliasBadge = ({ alias, color, className, ...props }: AliasBadgeProps) => {
  const palette = (color && printerColorPalette[color]) || redPrintColors.neutral

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
        className
      )}
      style={{
        backgroundColor: palette.background,
        color: palette.foreground,
      }}
      {...props}
    >
      <ColorDot color={color} />
      {alias}
    </span>
  )
}

export default AliasBadge
