import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSyncQueue } from '../hooks/useSyncQueue'
import { useToast } from '../components/Toast'
import api, { apiErrorMessage } from '../lib/api'
import { SYNC_DONE_EVENT } from '../lib/sync'
import { formatDateLong, formatNumber } from '../lib/format'
import type { Visit } from '../types/api'
import {
  Banner,
  Badge,
  Button,
  Card,
  EmptyState,
  Page,
  PageHeader,
  SectionTitle,
  SkeletonCard,
  estadoVisitaTone,
  tipoVisitaIcon,
  tipoVisitaTone,
} from '../components/ui'

export default function VisitDetailPage() {
  const { id } = useParams()
  const visitId = Number(id)
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const toast = useToast()
  const { items: queueItems } = useSyncQueue()

  const [visit, setVisit] = useState<Visit | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'complete' | 'reschedule' | 'omitir' | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [tick, setTick] = useState(0)

  const canLecturas = hasPermission('operaciones.lecturas')
  const canContratos = hasPermission('contratos')

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
    if (Number.isFinite(visitId)) void load()
  }, [load, visitId, tick])

  useEffect(() => {
    const handler = () => setTick((t) => t + 1)
    window.addEventListener(SYNC_DONE_EVENT, handler)
    return () => window.removeEventListener(SYNC_DONE_EVENT, handler)
  }, [])

  async function runAction(kind: 'complete' | 'reschedule' | 'omitir'): Promise<void> {
    setBusy(kind)
    setActionError(null)
    try {
      if (kind === 'complete') {
        await api.post(`/visits/${visitId}/complete`)
        toast.success('Visita completada')
      } else if (kind === 'reschedule') {
        if (!rescheduleDate) return
        await api.post(`/visits/${visitId}/reschedule`, { fecha_programada: rescheduleDate })
        toast.success('Visita reprogramada')
        setRescheduleDate('')
      } else {
        if (!window.confirm('¿Omitir esta visita? Dejará de generarse para este periodo.')) return
        await api.delete(`/visits/${visitId}`)
        toast.success('Visita omitida')
      }
      await load()
    } catch (e) {
      setActionError(apiErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  if (loading && visit === null) {
    return (
      <div>
        <PageHeader title="Visita" onBack={() => navigate(-1)} />
        <Page>
          <SkeletonCard />
          <SkeletonCard />
        </Page>
      </div>
    )
  }

  if (error || !visit) {
    return (
      <div>
        <PageHeader title="Visita" onBack={() => navigate(-1)} />
        <Page>
          <Banner tone="error">{error ?? 'No se pudo cargar la visita'}</Banner>
        </Page>
      </div>
    )
  }

  const estado = visit.estado
  const isEditable = estado === 'PENDIENTE' || estado === 'REPROGRAMADA'
  const printers = visit.impresoras ?? []
  const readings = visit.readings ?? []
  const capturedIds = new Set(readings.map((r) => String(r.impresora_id)))
  const queuedKeys = new Set(
    queueItems
      .filter((i) => i.estado === 'pendiente')
      .map((i) => `${i.payload.visita_id}:${i.payload.impresora_id}`)
  )
  const errorKeys = new Set(
    queueItems
      .filter((i) => i.estado === 'error')
      .map((i) => `${i.payload.visita_id}:${i.payload.impresora_id}`)
  )
  const progress =
    printers.length > 0
      ? printers.filter(
          (p) =>
            capturedIds.has(p.impresora_id) || queuedKeys.has(`${visit.id}:${p.impresora_id}`)
        ).length
      : 0

  return (
    <div>
      <PageHeader title={visit.cliente_nombre ?? `Cliente #${visit.cliente_id}`} onBack={() => navigate(-1)} />
      <Page>
        <Card className="mb-5">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {visit.tipo_visita && (
              <Badge tone={tipoVisitaTone[visit.tipo_visita]}>
                {tipoVisitaIcon[visit.tipo_visita]} {visit.tipo_visita}
              </Badge>
            )}
            {estado && <Badge tone={estadoVisitaTone[estado]}>{estado}</Badge>}
          </div>
          <p className="text-sm text-gray-600">
            📅 <span className="capitalize">{formatDateLong(visit.fecha_programada)}</span>
          </p>
          {visit.socio_nombre && (
            <p className="mt-1 text-sm text-gray-600">👤 {visit.socio_nombre}</p>
          )}
          {visit.contrato_id && (
            <p className="mt-1 text-sm text-gray-600">📄 Contrato #{visit.contrato_id}</p>
          )}
          {visit.notas && <p className="mt-2 text-sm italic text-gray-500">"{visit.notas}"</p>}
        </Card>

        {actionError && (
          <div className="mb-4">
            <Banner tone="error">{actionError}</Banner>
          </div>
        )}

        {visit.tipo_visita === 'LECTURA' && (
          <section className="mb-6">
            <SectionTitle hint="👆 Toca una impresora para capturar su lectura">
              Impresoras del contrato {printers.length > 0 && `(${progress}/${printers.length})`}
            </SectionTitle>
            {!canLecturas && (
              <div className="mb-3">
                <Banner tone="warn">No tienes permiso de capturar lecturas</Banner>
              </div>
            )}
            {printers.length === 0 && (
              <EmptyState icon="🖨️" text="El contrato no tiene impresoras activas" />
            )}
            {printers.map((p) => {
              const captured = capturedIds.has(p.impresora_id)
              const queued = queuedKeys.has(`${visit.id}:${p.impresora_id}`)
              const failed = errorKeys.has(`${visit.id}:${p.impresora_id}`)
              const reading = readings.find((r) => String(r.impresora_id) === p.impresora_id)
              return (
                <Card
                  key={p.id}
                  className="mb-3"
                  onClick={
                    captured || (!canLecturas && !queued && !failed)
                      ? undefined
                      : () => navigate(`/visita/${visitId}/captura/${p.impresora_id}`)
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-800">
                        {p.marca} {p.modelo}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">Serie: {p.numero_serie ?? '-'}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        Última lectura: {formatNumber(p.lectura_anterior)}
                        {p.fecha_lectura_anterior && ` (${p.fecha_lectura_anterior})`}
                      </p>
                    </div>
                    <span className="text-xl leading-none">🖨️</span>
                  </div>
                  <div className="mt-2.5">
                    {captured ? (
                      <Badge tone="emerald">
                        ✓ Capturada · {formatNumber(reading?.paginas_periodo)} págs
                      </Badge>
                    ) : queued ? (
                      <Badge tone="amber">⟳ Pendiente de sincronizar</Badge>
                    ) : failed ? (
                      <Badge tone="red">⚠ Error de sincronización</Badge>
                    ) : (
                      <Badge tone="blue">Tomar lectura →</Badge>
                    )}
                  </div>
                </Card>
              )
            })}
          </section>
        )}

        {visit.tipo_visita === 'INSTALACION' && (
          <section className="mb-6">
            <SectionTitle>Acción de visita</SectionTitle>
            {!canContratos && (
              <div className="mb-3">
                <Banner tone="warn">No tienes permiso de gestionar contratos</Banner>
              </div>
            )}
            {!visit.contrato_id ? (
              <Banner tone="warn">
                Esta visita no tiene contrato asociado: no se puede instalar
              </Banner>
            ) : (
              <Button
                variant="secondary"
                block
                disabled={!canContratos}
                onClick={() => navigate(`/visita/${visitId}/instalacion`)}
              >
                📥 Instalar Impresora
              </Button>
            )}
          </section>
        )}

        {visit.tipo_visita === 'RETIRO' && (
          <section className="mb-6">
            <SectionTitle>Acción de visita</SectionTitle>
            {!canContratos && (
              <div className="mb-3">
                <Banner tone="warn">No tienes permiso de gestionar contratos</Banner>
              </div>
            )}
            {!visit.contrato_id ? (
              <Banner tone="warn">
                Esta visita no tiene contrato asociado: no se puede retirar
              </Banner>
            ) : (
              <Button
                variant="secondary"
                block
                disabled={!canContratos}
                onClick={() => navigate(`/visita/${visitId}/retiro`)}
              >
                📤 Retirar Impresora
              </Button>
            )}
          </section>
        )}

        {visit.tipo_visita === 'MANTENIMIENTO' && (
          <section className="mb-6">
            <SectionTitle>Acción de visita</SectionTitle>
            <Banner tone="info">
              El mantenimiento de campo no está disponible en esta versión. Puedes registrar la
              visita como completada.
            </Banner>
          </section>
        )}

        {visit.tipo_visita !== 'LECTURA' && printers.length > 0 && (
          <section className="mb-6">
            <SectionTitle>Impresoras del contrato</SectionTitle>
            {printers.map((p) => (
              <Card key={p.id} className="mb-3">
                <p className="font-semibold text-gray-800">
                  {p.marca} {p.modelo}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">Serie: {p.numero_serie ?? '-'}</p>
              </Card>
            ))}
          </section>
        )}

        {readings.length > 0 && (
          <section className="mb-6">
            <SectionTitle>Lecturas registradas</SectionTitle>
            {readings.map((r) => (
              <Card key={r.id} className="mb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-800">
                      {r.impresora_nombre ?? `Impresora #${r.impresora_id}`}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">Fecha: {r.fecha}</p>
                  </div>
                  {r.es_anomalia && <Badge tone="red">Anómala</Badge>}
                </div>
                <div className="mt-2 flex gap-4 text-sm text-gray-600">
                  <span>Contador: {formatNumber(r.valor_contador)}</span>
                  <span>Páginas: {formatNumber(r.paginas_periodo)}</span>
                </div>
              </Card>
            ))}
          </section>
        )}

        <section className="mb-6">
          <SectionTitle>Acciones</SectionTitle>
          {!isEditable && (
            <p className="mb-2 text-xs text-gray-400">
              La visita está en estado {estado} y ya no puede modificarse.
            </p>
          )}
          {isEditable && (
            <div className="space-y-3">
              <Button
                block
                onClick={() => void runAction('complete')}
                loading={busy === 'complete'}
                disabled={busy !== null && busy !== 'complete'}
              >
                ✅ Completar visita
              </Button>
              <div className="rounded-xl border border-gray-200 p-3.5">
                <p className="mb-2 text-sm font-semibold text-gray-700">Reprogramar</p>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-800"
                />
                <Button
                  variant="secondary"
                  block
                  disabled={!rescheduleDate}
                  onClick={() => void runAction('reschedule')}
                  loading={busy === 'reschedule'}
                >
                  Reprogramar visita
                </Button>
              </div>
              <Button
                variant="outline"
                block
                onClick={() => void runAction('omitir')}
                loading={busy === 'omitir'}
                disabled={busy !== null && busy !== 'omitir'}
              >
                Omitir visita
              </Button>
            </div>
          )}
        </section>
      </Page>
    </div>
  )
}
