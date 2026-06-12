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
    primary: 'bg-blue-500 text-white',
    success: 'bg-green-500 text-white',
    warning: 'bg-amber-500 text-white',
    error: 'bg-red-500 text-white',
    info: 'bg-blue-500 text-white',
    neutral: 'bg-gray-500 text-white',
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
