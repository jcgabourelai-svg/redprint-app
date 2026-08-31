import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { printerStatusColors, documentStatusColors, contractStatusColors, clientStatusColors, visitTypeColors } from '@/types/colors'
import type { ColorVariant } from '@/types/colors'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: ColorVariant | 'printer_status' | 'document_status' | 'contract_status' | 'client_status' | 'visit_type'
  color?: string
}

const statusColorMap: Record<string, Record<string, { foreground: string; background: string }>> = {
  printer_status: printerStatusColors,
  document_status: documentStatusColors,
  contract_status: contractStatusColors,
  client_status: clientStatusColors,
  visit_type: visitTypeColors,
}

const Badge = ({ className, variant = 'primary', color, ...props }: BadgeProps) => {
  const baseStyles = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium'

  const variantClasses: Record<string, string> = {
    primary: 'bg-primary text-primary-foreground',
    success: 'bg-success text-success-foreground',
    warning: 'bg-warning text-warning-foreground',
    error: 'bg-destructive text-destructive-foreground',
    info: 'bg-info text-info-foreground',
    neutral: 'bg-muted-foreground text-background',
  }

  let inlineStyle: React.CSSProperties | undefined
  const isStatusVariant = variant in statusColorMap
  if (isStatusVariant && color) {
    // El API envia enums en mayusculas y las llaves del mapa son minusculas;
    // normalizamos para que el lookup siempre funcione.
    const statusColors = statusColorMap[variant]?.[String(color).toLowerCase()]
    if (statusColors) {
      inlineStyle = {
        backgroundColor: statusColors.background,
        color: statusColors.foreground,
      }
    }
  }

  return (
    <span
      className={cn(
        baseStyles,
        !isStatusVariant && variantClasses[variant],
        className
      )}
      style={inlineStyle}
      {...props}
    />
  )
}

export default Badge
