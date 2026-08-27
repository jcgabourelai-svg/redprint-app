import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api, { apiErrorMessage, fetchAll } from '../lib/api'
import { SYNC_DONE_EVENT } from '../lib/sync'
import {
  addDaysISO,
  formatDateLong,
  formatDayLabel,
  formatMonthLabel,
  nextMonth,
  prevMonth,
  todayISO,
} from '../lib/format'
import type { Paginated, Visit } from '../types/api'
import VisitCard from '../components/VisitCard'
import { Banner, Chip, EmptyState, Page, SkeletonCard } from '../components/ui'

type Filter = 'hoy' | 'semana' | 'mes'

async function loadVisits(): Promise<Visit[]> {
  const now = new Date()
  const months = [{ y: now.getFullYear(), m: now.getMonth() + 1 }]
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  if (now.getDate() + 7 > daysInMonth) {
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    months.push({ y: next.getFullYear(), m: next.getMonth() + 1 })
  }
  const results = await Promise.all(
    months.map((mo) => fetchAll<Visit>('/visits', { year: mo.y, month: mo.m }))
  )
  return results.flat()
}

export default function VisitsPage() {
  const { hasPermission } = useAuth()
  const canOperaciones = hasPermission('operaciones.calendario')
  const canNotif = hasPermission('sistema.notificaciones')

  const [filter, setFilter] = useState<Filter>('hoy')
  const [cursor, setCursor] = useState(() => {
    const n = new Date()
    return { year: n.getFullYear(), month: n.getMonth() + 1 }
  })
  const [visits, setVisits] = useState<Visit[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeOnly, setActiveOnly] = useState(true)
  const [unread, setUnread] = useState(0)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!canOperaciones) return
    let cancelled = false
    setVisits(null)
    const request =
      filter === 'mes'
        ? fetchAll<Visit>('/visits', { year: cursor.year, month: cursor.month })
        : loadVisits()
    request
      .then((v) => {
        if (!cancelled) {
          setVisits(v)
          setError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) setError(apiErrorMessage(e))
      })
    return () => {
      cancelled = true
    }
  }, [canOperaciones, filter, cursor, tick])

  useEffect(() => {
    const handler = () => setTick((t) => t + 1)
    window.addEventListener(SYNC_DONE_EVENT, handler)
    return () => window.removeEventListener(SYNC_DONE_EVENT, handler)
  }, [])

  useEffect(() => {
    if (!canNotif) return
    let cancelled = false
    api
      .get<Paginated<unknown>>('/notifications', { params: { leida: 0, per_page: 1 } })
      .then((res) => {
        if (!cancelled) setUnread(res.data.meta?.total ?? 0)
      })
      .catch(() => {
        if (!cancelled) setUnread(0)
      })
    return () => {
      cancelled = true
    }
  }, [canNotif])

  const groups = useMemo(() => {
    const today = todayISO()
    const limit = addDaysISO(today, 7)
    const map = new Map<string, Visit[]>()
    for (const v of visits ?? []) {
      const f = v.fecha_programada ?? ''
      if (filter === 'hoy' && f !== today) continue
      if (filter === 'semana' && !(f >= today && f <= limit)) continue
      if (activeOnly && v.estado !== 'PENDIENTE' && v.estado !== 'REPROGRAMADA') continue
      const key = v.fecha_programada ?? 'sin-fecha'
      const arr = map.get(key) ?? []
      arr.push(v)
      map.set(key, arr)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [visits, filter, activeOnly])

  if (!canOperaciones) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState icon="🔒" text="Tu cuenta no tiene acceso al módulo de operaciones de campo">
            <Link to="/perfil" className="text-sm font-semibold text-blue-600">
              Ver mi perfil →
            </Link>
          </EmptyState>
        </div>
      </div>
    )
  }

  return (
    <div>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4">
        <h1 className="text-lg font-bold text-gray-800">RedPrint Operativo</h1>
        {canNotif && (
          <Link
            to="/notificaciones"
            aria-label="Notificaciones"
            className="relative h-9 w-9 text-center text-xl leading-9"
          >
            🔔
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </Link>
        )}
      </header>

      <Page>
        <p className="mb-4 text-sm font-medium capitalize text-gray-500">
          {formatDateLong(todayISO())}
        </p>

        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Chip active={filter === 'hoy'} onClick={() => setFilter('hoy')}>
              Hoy
            </Chip>
            <Chip active={filter === 'semana'} onClick={() => setFilter('semana')}>
              7 días
            </Chip>
            <Chip active={filter === 'mes'} onClick={() => setFilter('mes')}>
              Mes
            </Chip>
          </div>
          <Link
            to="/visita/nueva"
            aria-label="Nueva visita"
            className="shrink-0 rounded-full bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white active:bg-blue-600"
          >
            + Visita
          </Link>
        </div>

        {filter === 'mes' && (
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => setCursor((c) => prevMonth(c))}
              aria-label="Mes anterior"
              className="h-9 w-9 rounded-full bg-gray-100 text-lg text-gray-600 active:bg-gray-200"
            >
              ‹
            </button>
            <p className="text-sm font-bold capitalize text-gray-800">
              {formatMonthLabel(cursor.year, cursor.month)}
            </p>
            <button
              onClick={() => setCursor((c) => nextMonth(c))}
              aria-label="Mes siguiente"
              className="h-9 w-9 rounded-full bg-gray-100 text-lg text-gray-600 active:bg-gray-200"
            >
              ›
            </button>
          </div>
        )}

        <div className="mb-5 flex gap-2">
          <Chip active={activeOnly} onClick={() => setActiveOnly(true)}>
            Activas
          </Chip>
          <Chip active={!activeOnly} onClick={() => setActiveOnly(false)}>
            Todas
          </Chip>
        </div>

        {error && (
          <div className="mb-4 space-y-2">
            <Banner tone="error">{error}</Banner>
            <button
              onClick={() => setTick((t) => t + 1)}
              className="text-sm font-semibold text-blue-600"
            >
              Reintentar
            </button>
          </div>
        )}

        {visits === null && !error && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {visits !== null && groups.length === 0 && !error && (
          <EmptyState
            icon="📅"
            text={
              filter === 'hoy'
                ? 'No tienes visitas programadas para hoy'
                : filter === 'semana'
                  ? 'No tienes visitas en los próximos 7 días'
                  : 'No hay visitas este mes'
            }
          >
            <Link to="/visita/nueva" className="text-sm font-semibold text-blue-600">
              Programar visita →
            </Link>
          </EmptyState>
        )}

        {groups.map(([day, dayVisits]) => (
          <section key={day} className="mb-5">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400 capitalize">
              {day === 'sin-fecha' ? 'Sin fecha' : formatDayLabel(day)}
            </h3>
            {dayVisits.map((v) => (
              <VisitCard key={v.id} visit={v} />
            ))}
          </section>
        ))}
      </Page>
    </div>
  )
}
