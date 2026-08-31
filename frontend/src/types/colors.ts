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

/**
 * Paleta por tipo de visita (keys minusculas; el Badge normaliza el enum).
 * Espejo de la app movil (tipoVisitaTone): lectura=azul, mantenimiento=violeta,
 * instalacion=esmeralda, retiro=naranja, entrega_insumos=celeste.
 */
export const visitTypeColors: Record<string, ColorSet> = {
  lectura: {
    DEFAULT: '#2563EB',
    foreground: '#1D4ED8',
    background: '#EFF6FF',
  },
  mantenimiento: {
    DEFAULT: '#7C3AED',
    foreground: '#6D28D9',
    background: '#F5F3FF',
  },
  instalacion: {
    DEFAULT: '#059669',
    foreground: '#047857',
    background: '#ECFDF5',
  },
  retiro: {
    DEFAULT: '#EA580C',
    foreground: '#C2410C',
    background: '#FFF7ED',
  },
  entrega_insumos: {
    DEFAULT: '#0284C7',
    foreground: '#0369A1',
    background: '#F0F9FF',
  },
}

/**
 * Paleta de identidad por impresora en contrato (keys sin acentos, viven en
 * contract_printer.color). El backend es la fuente de verdad de las keys;
 * este mapa key -> hex es solo presentacion. Escala 700/100/900 tipo
 * Tailwind: texto oscuro sobre fondo pastel (contraste AA) y sin rojo puro
 * para no colisionar con los badges de estado (error/CRITICA).
 */
export const printerColorPalette: Record<string, ColorSet> = {
  azul: {
    DEFAULT: '#1D4ED8',
    foreground: '#1E3A8A',
    background: '#DBEAFE',
  },
  turquesa: {
    DEFAULT: '#0F766E',
    foreground: '#134E4A',
    background: '#CCFBF1',
  },
  verde: {
    DEFAULT: '#15803D',
    foreground: '#14532D',
    background: '#DCFCE7',
  },
  ambar: {
    DEFAULT: '#B45309',
    foreground: '#78350F',
    background: '#FEF3C7',
  },
  naranja: {
    DEFAULT: '#C2410C',
    foreground: '#7C2D12',
    background: '#FFEDD5',
  },
  morado: {
    DEFAULT: '#7C3AED',
    foreground: '#4C1D95',
    background: '#EDE9FE',
  },
  rosa: {
    DEFAULT: '#DB2777',
    foreground: '#831843',
    background: '#FCE7F3',
  },
  gris: {
    DEFAULT: '#475569',
    foreground: '#1E293B',
    background: '#E2E8F0',
  },
}
