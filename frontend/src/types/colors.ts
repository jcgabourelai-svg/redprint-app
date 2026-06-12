export type ColorVariant = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral'

export interface ColorSet {
  DEFAULT: string
  foreground: string
  background: string
}

export const redPrintColors: Record<ColorVariant, ColorSet> = {
  primary: {
    DEFAULT: '#3B82F6',
    foreground: '#FFFFFF',
    background: '#EFF6FF',
  },
  success: {
    DEFAULT: '#10B981',
    foreground: '#FFFFFF',
    background: '#ECFDF5',
  },
  warning: {
    DEFAULT: '#F59E0B',
    foreground: '#FFFFFF',
    background: '#FFFBEB',
  },
  error: {
    DEFAULT: '#EF4444',
    foreground: '#FFFFFF',
    background: '#FEF2F2',
  },
  info: {
    DEFAULT: '#3B82F6',
    foreground: '#FFFFFF',
    background: '#EFF6FF',
  },
  neutral: {
    DEFAULT: '#6B7280',
    foreground: '#FFFFFF',
    background: '#F3F4F6',
  },
}

export const printerStatusColors: Record<string, ColorSet> = {
  en_almacen: {
    DEFAULT: '#3B82F6',
    foreground: '#1E40AF',
    background: '#EFF6FF',
  },
  rentada: {
    DEFAULT: '#10B981',
    foreground: '#065F46',
    background: '#ECFDF5',
  },
  en_mantenimiento: {
    DEFAULT: '#F59E0B',
    foreground: '#92400E',
    background: '#FFFBEB',
  },
  dada_de_baja: {
    DEFAULT: '#6B7280',
    foreground: '#374151',
    background: '#F3F4F6',
  },
}

export const documentStatusColors: Record<string, ColorSet> = {
  activo: {
    DEFAULT: '#3B82F6',
    foreground: '#1E40AF',
    background: '#EFF6FF',
  },
  pendiente: {
    DEFAULT: '#3B82F6',
    foreground: '#1E40AF',
    background: '#EFF6FF',
  },
  completado: {
    DEFAULT: '#10B981',
    foreground: '#065F46',
    background: '#ECFDF5',
  },
  pagado: {
    DEFAULT: '#10B981',
    foreground: '#065F46',
    background: '#ECFDF5',
  },
  vencido: {
    DEFAULT: '#EF4444',
    foreground: '#991B1B',
    background: '#FEF2F2',
  },
  cancelado: {
    DEFAULT: '#6B7280',
    foreground: '#374151',
    background: '#F3F4F6',
  },
  parcialmente_pagado: {
    DEFAULT: '#F59E0B',
    foreground: '#92400E',
    background: '#FFFBEB',
  },
  suspendido: {
    DEFAULT: '#8B5CF6',
    foreground: '#5B21B6',
    background: '#F5F3FF',
  },
  en_proceso: {
    DEFAULT: '#F59E0B',
    foreground: '#92400E',
    background: '#FFFBEB',
  },
  completada: {
    DEFAULT: '#10B981',
    foreground: '#065F46',
    background: '#ECFDF5',
  },
  cancelada: {
    DEFAULT: '#6B7280',
    foreground: '#374151',
    background: '#F3F4F6',
  },
}

export const contractStatusColors: Record<string, ColorSet> = {
  activo: {
    DEFAULT: '#10B981',
    foreground: '#065F46',
    background: '#ECFDF5',
  },
  suspendido: {
    DEFAULT: '#8B5CF6',
    foreground: '#5B21B6',
    background: '#F5F3FF',
  },
  finalizado: {
    DEFAULT: '#6B7280',
    foreground: '#374151',
    background: '#F3F4F6',
  },
  cancelado: {
    DEFAULT: '#EF4444',
    foreground: '#991B1B',
    background: '#FEF2F2',
  },
}

export const clientStatusColors: Record<string, ColorSet> = {
  al_corriente: {
    DEFAULT: '#10B981',
    foreground: '#065F46',
    background: '#ECFDF5',
  },
  pendiente: {
    DEFAULT: '#F59E0B',
    foreground: '#92400E',
    background: '#FFFBEB',
  },
  vencido: {
    DEFAULT: '#EF4444',
    foreground: '#991B1B',
    background: '#FEF2F2',
  },
}
