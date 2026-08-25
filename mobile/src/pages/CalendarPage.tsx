import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { apiErrorMessage, fetchAll } from '../lib/api'
import { SYNC_DONE_EVENT } from '../lib/sync'
import {
  formatDayLabel,
  formatMonthLabel,
  nextMonth,
  prevMonth,
} from '../lib/format'
import type { Visit } from '../types/api'
import VisitCard from '../components/VisitCard'
import { Banner, Chip, EmptyState, Page, PageHeader, SkeletonCard } from '../components/ui'

export default function CalendarPage() {
  const { hasPermission } = useAuth()
  const canOperaciones = hasPermission('operaciones.calendario')

  const [cursor, setCursor] = useState(() => {
    const n = new Date()
    return { year: n.getFullYear(), month: n.getMonth() + 1 }
  })
  const [visits, setVisits] = useState<Visit[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeOnly, setActiveOnly] = useState(true)

  useEffect(() => {
    if (!canOperaciones) return
    let cancelled = false
    setVisits(null)
    fetchAll<Visit>('/visits', { year: cursor.year, month: cursor.month })
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
  }, [canOperaciones, cursor])

  useEffect(() => {
    const handler = () => setVisits(null)
    window.addEventListener(SYNC_DONE_EVENT, handler)
    return () => window.removeEventListener(SYNC_DONE_EVENT, handler)
  }, [])

  const groups = useMemo(() => {
    const map = new Map<string, Visit[]>()
    for (const v of visits ?? []) {
      if (activeOnly && v.estado !== 'PENDIENTE' && v.estado !== 'REPROGRAMADA') continue
      const key = v.fecha_programada ?? 'sin-fecha'
      const arr = map.get(key) ?? []
      arr.push(v)
      map.set(key, arr)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [visits, activeOnly])

  return (
    <div>
      <PageHeader title="Calendario" />
      <Page>
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

        <div className="mb-5 flex gap-2">
          <Chip active={activeOnly} onClick={() => setActiveOnly(true)}>
            Activas
          </Chip>
          <Chip active={!activeOnly} onClick={() => setActiveOnly(false)}>
            Todas
          </Chip>
        </div>

        {error && <Banner tone="error">{error}</Banner>}

        {visits === null && !error && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {visits !== null && groups.length === 0 && !error && (
          <EmptyState icon="📅" text="No tienes visitas programadas en este período" />
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
