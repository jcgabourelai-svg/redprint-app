import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger'
  block?: boolean
  loading?: boolean
}

const buttonVariants: Record<string, string> = {
  primary: 'bg-blue-500 text-white active:bg-blue-600 disabled:bg-blue-300',
  secondary: 'bg-gray-100 text-gray-800 active:bg-gray-200 disabled:text-gray-400',
  outline:
    'border border-blue-500 text-blue-600 active:bg-blue-50 disabled:border-gray-300 disabled:text-gray-400',
  danger: 'bg-red-500 text-white active:bg-red-600 disabled:bg-red-300',
}

export function Button({
  variant = 'primary',
  block = false,
  loading = false,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${buttonVariants[variant]} ${block ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

type BadgeTone =
  | 'gray'
  | 'blue'
  | 'emerald'
  | 'amber'
  | 'sky'
  | 'orange'
  | 'violet'
  | 'red'

const badgeTones: Record<BadgeTone, string> = {
  gray: 'bg-gray-100 text-gray-600',
  blue: 'bg-blue-50 text-blue-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  sky: 'bg-sky-50 text-sky-700',
  orange: 'bg-orange-50 text-orange-700',
  violet: 'bg-violet-50 text-violet-700',
  red: 'bg-red-50 text-red-700',
}

export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeTones[tone]}`}
    >
      {children}
    </span>
  )
}

export const tipoVisitaTone: Record<string, BadgeTone> = {
  LECTURA: 'blue',
  MANTENIMIENTO: 'violet',
  INSTALACION: 'emerald',
  RETIRO: 'orange',
  ENTREGA_INSUMOS: 'sky',
}

export const estadoVisitaTone: Record<string, BadgeTone> = {
  PENDIENTE: 'amber',
  REPROGRAMADA: 'sky',
  COMPLETADA: 'emerald',
  CANCELADA: 'gray',
  OMITIDA: 'gray',
}

export const tipoVisitaIcon: Record<string, string> = {
  LECTURA: '🖨️',
  MANTENIMIENTO: '🔧',
  INSTALACION: '📥',
  RETIRO: '📤',
  ENTREGA_INSUMOS: '📦',
}

export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-4 pb-28 pt-4 ${className}`}>{children}</div>
}

export function PageHeader({
  title,
  onBack,
  right,
}: {
  title: ReactNode
  onBack?: () => void
  right?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b border-gray-200 bg-white px-3">
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Volver"
          className="h-9 w-9 shrink-0 text-xl text-gray-600 active:text-gray-900"
        >
          ←
        </button>
      )}
      <h1 className="min-w-0 flex-1 truncate text-center text-lg font-bold text-gray-800">
        {title}
      </h1>
      <div className="flex w-9 shrink-0 justify-end">{right}</div>
    </header>
  )
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-2">
      <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">{children}</h2>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className = '', onClick }: CardProps) {
  const base = `rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm ${className}`
  if (onClick) {
    return (
      <button onClick={onClick} className={`${base} w-full text-left active:bg-gray-50`}>
        {children}
      </button>
    )
  }
  return <div className={base}>{children}</div>
}

export function EmptyState({
  icon = '📅',
  text,
  children,
}: {
  icon?: string
  text: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="text-4xl">{icon}</div>
      <p className="text-sm text-gray-500">{text}</p>
      {children}
    </div>
  )
}

export function Banner({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn' | 'error'
  children: ReactNode
}) {
  const tones = {
    info: 'bg-blue-50 text-blue-800 border-blue-200',
    warn: 'bg-amber-50 text-amber-800 border-amber-200',
    error: 'bg-red-50 text-red-800 border-red-200',
  }
  return (
    <div className={`rounded-lg border px-3.5 py-2.5 text-sm ${tones[tone]}`}>{children}</div>
  )
}

export function Chip({
  active = false,
  children,
  onClick,
}: {
  active?: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
      }`}
    >
      {children}
    </button>
  )
}

export function Field({
  label,
  help,
  error,
  children,
}: {
  label: string
  help?: string
  error?: string | null
  children: ReactNode
}) {
  return (
    <div className="mb-4">
      <label className="mb-1 block text-sm font-semibold text-gray-700">{label}</label>
      {children}
      {help && !error && <p className="mt-1 text-xs text-gray-400">{help}</p>}
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
}

export function TextInput({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${className}`}
      {...rest}
    />
  )
}

export function TextArea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${className}`}
      {...rest}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="mb-3 animate-pulse rounded-xl border border-gray-100 bg-gray-50 p-4">
      <div className="mb-2 h-4 w-2/3 rounded bg-gray-200" />
      <div className="mb-3 h-3 w-1/3 rounded bg-gray-200" />
      <div className="flex gap-2">
        <div className="h-5 w-16 rounded-full bg-gray-200" />
        <div className="h-5 w-20 rounded-full bg-gray-200" />
      </div>
    </div>
  )
}
