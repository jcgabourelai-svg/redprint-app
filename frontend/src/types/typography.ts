export type TypographySize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'
export type TypographyWeight = 'regular' | 'medium' | 'semibold' | 'bold'

export interface TypographyVariant {
  size: string
  weight: string
  lineHeight: string
  letterSpacing?: string
  fontVariantNumeric?: string
}

export const typographyVariants: Record<string, TypographyVariant> = {
  h1: {
    size: '2.25rem',
    weight: '700',
    lineHeight: '2.5rem',
  },
  h2: {
    size: '1.5rem',
    weight: '700',
    lineHeight: '2rem',
  },
  h2Mobile: {
    size: '1.25rem',
    weight: '700',
    lineHeight: '1.75rem',
  },
  h3: {
    size: '1.125rem',
    weight: '600',
    lineHeight: '1.5rem',
  },
  h3Mobile: {
    size: '1rem',
    weight: '600',
    lineHeight: '1.5rem',
  },
  subtitle: {
    size: '1rem',
    weight: '500',
    lineHeight: '1.5rem',
  },
  subtitleMobile: {
    size: '0.875rem',
    weight: '500',
    lineHeight: '1.25rem',
  },
  body: {
    size: '0.875rem',
    weight: '400',
    lineHeight: '1.25rem',
  },
  caption: {
    size: '0.75rem',
    weight: '400',
    lineHeight: '1rem',
  },
  numbers: {
    size: '0.875rem',
    weight: '500',
    lineHeight: '1.25rem',
    fontVariantNumeric: 'tabular-nums',
  },
  numbersMobile: {
    size: '0.875rem',
    weight: '500',
    lineHeight: '1.25rem',
  },
  button: {
    size: '0.875rem',
    weight: '500',
    lineHeight: '1.25rem',
  },
}
