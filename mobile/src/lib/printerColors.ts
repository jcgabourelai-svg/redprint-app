import type { CSSProperties } from 'react'

/**
 * Paleta de identidad por impresora en contrato (keys sin acentos que viven
 * en contract_printer.color). El backend es la fuente de verdad de las keys;
 * este mapa key -> hex es solo presentacion. Escala 700/100/900 tipo
 * Tailwind: texto oscuro sobre fondo pastel y sin rojo puro para no
 * colisionar con los indicadores de estado (error/CRITICA).
 */
export interface PrinterColorSet {
  dot: string
  background: string
  foreground: string
}

export const printerColorPalette: Record<string, PrinterColorSet> = {
  azul: { dot: '#1D4ED8', background: '#DBEAFE', foreground: '#1E3A8A' },
  turquesa: { dot: '#0F766E', background: '#CCFBF1', foreground: '#134E4A' },
  verde: { dot: '#15803D', background: '#DCFCE7', foreground: '#14532D' },
  ambar: { dot: '#B45309', background: '#FEF3C7', foreground: '#78350F' },
  naranja: { dot: '#C2410C', background: '#FFEDD5', foreground: '#7C2D12' },
  morado: { dot: '#7C3AED', background: '#EDE9FE', foreground: '#4C1D95' },
  rosa: { dot: '#DB2777', background: '#FCE7F3', foreground: '#831843' },
  gris: { dot: '#475569', background: '#E2E8F0', foreground: '#1E293B' },
}

const NEUTRAL_DOT = '#6B7280'

/** Estilo inline del punto de color; key null/desconocida -> gris neutro. */
export function printerDotStyle(color?: string | null): CSSProperties {
  return {
    backgroundColor: (color && printerColorPalette[color]?.dot) || NEUTRAL_DOT,
  }
}
