import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSyncQueue } from '../hooks/useSyncQueue'
import api, { apiErrorMessage, fetchAll } from '../lib/api'
import { SYNC_DONE_EVENT } from '../lib/sync'
import { formatDateTime, formatNumber } from '../lib/format'
import type { Reading, Visit } from '../types/api'
import {
  Banner,
  Badge,
  Card,
  EmptyState,
  Page,
  PageHeader,
  SectionTitle,
  SkeletonCard,
} from '../components/ui'

function ActionCard({
  icon,
  label,
  onClick,
  disabled,
  danger = false,
}: {
  icon: string
  label: ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
        danger
          ? 'border-red-200 bg-red-50 text-red-700 active:bg-red-100 disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400'
          : 'border-gray-200 bg-white text-gray-800 active:bg-gray-50 disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400'
      }`}
    >
      <span className="text-2xl leading-none">{icon}</span>
      <span className="leading-snug">{label}</span>
    </button>
  )
}

export default function PrinterDetailPage() {
  const { id, printerId } = useParams()
  const visitId = Number(id)
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const { items: queueItems } = useSyncQueue()

  const [visit, setVisit] = useState<Visit | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const [history, setHistory] = useState<Reading[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const canLecturas = hasPermission('operaciones.lecturas')
  const canMantenimiento = hasPermission('inventario.mantenimiento')
  const canRetirar = hasPermission('contratos') && hasPermission('inventario.almacenes')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<Visit>(`/visits/${visitId}`)
      setVisit(res.data)
      setError(null)
    } catch (e) {
      setError(apiErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [visitId])

  useEffect(() => {
    if (Number.isFinite(visitId) && printerId) void load()
  }, [load, visitId, printerId, tick])

  useEffect(() => {
    const handler = () => setTick((t) => t + 1)
    window.addEventListener(SYNC_DONE_EVENT, handler)
    return () => window.removeEventListener(SYNC_DONE_EVENT, handler)
  }, [])

  async function loadHistory(): Promise<void> {
    if (!printerId) return
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const rows = await fetchAll<Reading>(`/readings/printer/${printerId}`)
      setHistory(rows)
    } catch (e) {
      setHistoryError(apiErrorMessage(e))
    } finally {
      setHistoryLoading(false)
    }
  }

  function toggleHistory(): void {
    if (history !== null) {
      setHistory(null)
      return
    }
    void loadHistory()
  }

  if (loading && visit === null) {
    return (
      <div>
        <PageHeader title="Impresora" onBack={() => navigate(`/visita/${visitId}`)} />
        <Page>
          <SkeletonCard />
        </Page>
      </div>
    )
  }

  if (error || !visit) {
    return (
      <div>
        <PageHeader title="Impresora" onBack={() => navigate(`/visita/${visitId}`)} />
        <Page>
          <Banner tone="error">{error ?? 'No se pudo cargar la impresora'}</Banner>
        </Page>
      </div>
    )
  }

  const printer = visit.impresoras?.find((p) => p.impresora_id === printerId) ?? null

  if (!printer) {
    return (
      <div>
        <PageHeader title="Impresora" onBack={() => navigate(`/visita/${visitId}`)} />
        <Page>
          <EmptyState icon="🖨️" text="La impresora no pertenece a esta visita" />
        </Page>
      </div>
    )
  }

  const estado = visit.estado
  const isEditable = estado === 'PENDIENTE' || estado === 'REPROGRAMADA'
  const readings = visit.readings ?? []
  const captured = readings.some((r) => String(r.impresora_id) === printerId)
  const queued = queueItems.some(
    (i) =>
      i.estado === 'pendiente' &&
      `${i.payload.visita_id}:${i.payload.impresora_id}` === `${visit.id}:${printerId}`
  )
  const failed = queueItems.some(
    (i) =>
      i.estado === 'error' &&
      `${i.payload.visita_id}:${i.payload.impresora_id}` === `${visit.id}:${printerId}`
  )
  const reading = readings.find((r) => String(r.impresora_id) === printerId)

  const statusBadge = captured ? (
    <Badge tone="emerald">✓ Capturada en esta visita</Badge>
  ) : queued ? (
    <Badge tone="amber">⟳ Pendiente de sincronizar</Badge>
  ) : failed ? (
    <Badge tone="red">⚠ Error de sincronización</Badge>
  ) : (
    <Badge tone="blue">Sin lectura en esta visita</Badge>
  )

  return (
    <div>
      <PageHeader title={`${printer.marca} ${printer.modelo}`} onBack={() => navigate(`/visita/${visitId}`)} />
      <Page>
        <Card className="mb-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-gray-800">
                {printer.marca} {printer.modelo}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">Serie: {printer.numero_serie ?? '-'}</p>
              <p className="mt-1 text-xs text-gray-500">
                Última lectura: {formatNumber(printer.lectura_anterior)}
                {printer.fecha_lectura_anterior && ` (${printer.fecha_lectura_anterior})`}
              </p>
            </div>
            <span className="text-xl leading-none">🖨️</span>
          </div>
          <div className="mt-2.5">
            {statusBadge}
            {captured && (
              <p className="mt-1 text-xs text-emerald-700">
                {formatNumber(reading?.paginas_periodo)} páginas registradas
              </p>
            )}
          </div>
        </Card>

        {!isEditable && (
          <div className="mb-4">
            <Banner tone="info">
              La visita está en estado {estado}; las acciones ya no están disponibles.
            </Banner>
          </div>
        )}

        <section className="mb-6">
          <SectionTitle hint="Acciones para esta impresora">Acciones disponibles</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <ActionCard
              icon="📊"
              label={captured ? '✓ Lectura capturada' : 'Tomar lectura'}
              disabled={!isEditable || !canLecturas || captured || queued}
              onClick={() => navigate(`/visita/${visitId}/captura/${printerId}`)}
            />
            <ActionCard
              icon="⚠️"
              label="Reportar falla"
              disabled={!isEditable || !canMantenimiento}
              onClick={() => navigate(`/visita/${visitId}/falla?impresora=${printerId}`)}
            />
            <ActionCard
              icon="⏱️"
              label={history !== null ? 'Ocultar historial' : 'Ver historial'}
              disabled={!canLecturas}
              onClick={toggleHistory}
            />
            <ActionCard
              icon="📤"
              label="Retirar impresora"
              danger
              disabled={
                !isEditable || !canRetirar || !visit.contrato_id || (visit.impresoras?.length ?? 0) === 0
              }
              onClick={() => navigate(`/visita/${visitId}/retiro?impresora=${printerId}`)}
            />
          </div>
          {!canLecturas && (
            <p className="mt-2 text-xs text-gray-400">
              No tienes permiso para capturar lecturas ni ver el historial.
            </p>
          )}
        </section>

        {historyLoading && <SkeletonCard />}

        {historyError && (
          <div className="mb-4">
            <Banner tone="error">{historyError}</Banner>
          </div>
        )}

        {history !== null && (
          <section className="mb-6">
            <SectionTitle hint="Lecturas registradas de esta impresora">Historial</SectionTitle>
            {history.length === 0 && (
              <EmptyState icon="⏱️" text="Esta impresora aún no tiene lecturas registradas" />
            )}
            {history.map((r) => (
              <Card key={r.id} className="mb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">
                      {r.fecha ? formatDateTime(r.fecha) : '-'}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                      <span>Contador: {formatNumber(r.valor_contador)}</span>
                      <span>Páginas: {formatNumber(r.paginas_periodo)}</span>
                    </div>
                    {r.socio_capturista && (
                      <p className="mt-0.5 text-xs text-gray-400">Por: {r.socio_capturista}</p>
                    )}
                  </div>
                  {r.es_anomalia && <Badge tone="red">Anómala</Badge>}
                </div>
              </Card>
            ))}
          </section>
        )}
      </Page>
    </div>
  )
}
