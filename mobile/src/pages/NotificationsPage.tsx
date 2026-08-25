import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import api, { apiErrorMessage, fetchAll } from '../lib/api'
import { formatDateTime } from '../lib/format'
import type { AppNotification } from '../types/api'
import { useToast } from '../components/Toast'
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  Page,
  PageHeader,
  SkeletonCard,
} from '../components/ui'

export default function NotificationsPage() {
  const { hasPermission } = useAuth()
  const toast = useToast()
  const canNotif = hasPermission('sistema.notificaciones')

  const [items, setItems] = useState<AppNotification[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!canNotif) return
    let cancelled = false
    fetchAll<AppNotification>('/notifications')
      .then((ns) => {
        if (!cancelled) {
          setItems(ns)
          setError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) setError(apiErrorMessage(e))
      })
    return () => {
      cancelled = true
    }
  }, [canNotif, tick])

  async function markRead(n: AppNotification) {
    if (n.leida) return
    setItems((prev) =>
      prev?.map((x) => (x.id === n.id ? { ...x, leida: true } : x)) ?? prev
    )
    try {
      await api.post(`/notifications/${n.id}/read`)
    } catch (e) {
      toast.error(apiErrorMessage(e))
      setTick((t) => t + 1)
    }
  }

  async function markAll() {
    setMarkingAll(true)
    try {
      await api.post('/notifications/read-all')
      toast.success('Notificaciones marcadas como leídas')
      setItems((prev) => prev?.map((x) => ({ ...x, leida: true })) ?? prev)
    } catch (e) {
      toast.error(apiErrorMessage(e))
    } finally {
      setMarkingAll(false)
    }
  }

  const unread = items?.filter((n) => !n.leida).length ?? 0

  return (
    <div>
      <PageHeader title="Alertas" />
      <Page>
        {!canNotif && (
          <Banner tone="error">No tienes permiso para ver notificaciones.</Banner>
        )}

        {canNotif && error && <Banner tone="error">{error}</Banner>}

        {canNotif && items === null && !error && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {canNotif && items !== null && items.length === 0 && !error && (
          <EmptyState icon="🔔" text="No hay notificaciones" />
        )}

        {canNotif && unread > 0 && (
          <div className="mb-4">
            <Button variant="secondary" block loading={markingAll} onClick={() => void markAll()}>
              Marcar todas como leídas ({unread})
            </Button>
          </div>
        )}

        {items?.map((n) => (
          <button
            key={n.id}
            onClick={() => void markRead(n)}
            className={`mb-3 w-full rounded-xl border p-3.5 text-left shadow-sm active:bg-gray-50 ${
              n.leida
                ? 'border-gray-200 bg-white'
                : 'border-blue-200 bg-blue-50/50'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`truncate font-semibold ${n.leida ? 'text-gray-700' : 'text-gray-900'}`}>
                  {n.titulo ?? 'Notificación'}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">{formatDateTime(n.fecha)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {n.tipo && <Badge tone="gray">{n.tipo}</Badge>}
                {!n.leida && <span className="h-2 w-2 rounded-full bg-blue-500" />}
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-600">{n.mensaje}</p>
          </button>
        ))}
      </Page>
    </div>
  )
}
