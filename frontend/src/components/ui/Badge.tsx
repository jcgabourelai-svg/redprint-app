import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { printerStatusColors, documentStatusColors, contractStatusColors, clientStatusColors } from '@/types/colors'
import type { ColorVariant } from '@/types/colors'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: ColorVariant | 'printer_status' | 'document_status' | 'contract_status' | 'client_status'
  color?: string
}

const statusColorMap: Record<string, Record<string, { foreground: string; background: string }>> = {
  printer_status: printerStatusColors,
  document_status: documentStatusColors,
  contract_status: contractStatusColors,
  client_status: clientStatusColors,
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
  if ((variant === 'printer_status' || variant === 'document_status' || variant === 'contract_status' || variant === 'client_status') && color) {
    const statusColors = statusColorMap[variant]?.[color]
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
        variant !== 'printer_status' && variant !== 'document_status' && variant !== 'contract_status' && variant !== 'client_status' && variantClasses[variant],
        className
      )}
      style={inlineStyle}
      {...props}
    />
  )
}

export default Badge
