import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api, { apiErrorMessage, fetchAll } from '../lib/api'
import { SYNC_DONE_EVENT } from '../lib/sync'
import { addDaysISO, formatDateLong, todayISO } from '../lib/format'
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

export default function TodayPage() {
  const { hasPermission } = useAuth()
  const canOperaciones = hasPermission('operaciones.calendario')
  const canNotif = hasPermission('sistema.notificaciones')

  const [visits, setVisits] = useState<Visit[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('hoy')
  const [unread, setUnread] = useState(0)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!canOperaciones) return
    let cancelled = false
    loadVisits()
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
  }, [canOperaciones, tick])

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

  const filtered = useMemo(() => {
    const today = todayISO()
    const limit = addDaysISO(today, 7)
    return (visits ?? []).filter((v) => {
      const f = v.fecha_programada ?? ''
      if (filter === 'hoy') return f === today
      if (filter === 'semana') return f >= today && f <= limit
      return true
    })
  }, [visits, filter])

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

        <div className="mb-4 flex gap-2">
          <Chip active={filter === 'hoy'} onClick={() => setFilter('hoy')}>
            Hoy
          </Chip>
          <Chip active={filter === 'semana'} onClick={() => setFilter('semana')}>
            7 días
          </Chip>
          <Chip active={filter === 'mes'} onClick={() => setFilter('mes')}>
            Mes actual
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

        {visits !== null && filtered.length === 0 && !error && (
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
            <Link to="/calendario" className="text-sm font-semibold text-blue-600">
              Ver calendario →
            </Link>
          </EmptyState>
        )}

        {filtered.map((v) => (
          <VisitCard key={v.id} visit={v} />
        ))}
      </Page>
    </div>
  )
}
