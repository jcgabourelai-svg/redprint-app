import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useGoBack } from '../hooks/useGoBack'
import { useSyncQueue } from '../hooks/useSyncQueue'
import { useToast } from '../components/Toast'
import api, { apiErrorMessage } from '../lib/api'
import { SYNC_DONE_EVENT } from '../lib/sync'
import { formatDateLong, formatDateTime, formatMoney, formatNumber } from '../lib/format'
import type { Visit } from '../types/api'
import type { ReadingQueueItem } from '../lib/db'
import {
  Banner,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Page,
  PageHeader,
  SectionTitle,
  SkeletonCard,
  TextArea,
  estadoVisitaTone,
  tipoVisitaIcon,
  tipoVisitaTone,
} from '../components/ui'

const eventoCambioLabels: Record<string, string> = {
  ASIGNACION_CONTRATO: '📥 Instalada en esta visita',
  LIBERACION_CONTRATO: '📤 Retirada en esta visita',
}

function telHref(tel: string): string {
  return tel.replace(/[^\d+]/g, '')
}

export default function VisitDetailPage() {
  const { id } = useParams()
  const visitId = Number(id)
  const navigate = useNavigate()
  const goBackTo = useGoBack()
  const { hasPermission } = useAuth()
  const toast = useToast()
  const { items: queueItems } = useSyncQueue()

  const [visit, setVisit] = useState<Visit | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'complete' | 'reschedule' | 'omitir' | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [motivoCierre, setMotivoCierre] = useState('')
  const [tick, setTick] = useState(0)

  const canContratos = hasPermission('contratos')
  const canInsumos = hasPermission('inventario.articulos')
  const canInstalar = canContratos && hasPermission('inventario.impresoras')

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

  async function runAction(kind: 'reschedule' | 'omitir'): Promise<void> {
    setBusy(kind)
    setActionError(null)
    try {
      if (kind === 'reschedule') {
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

  async function handleComplete(): Promise<void> {
    setBusy('complete')
    setActionError(null)
    try {
      await api.post(`/visits/${visitId}/complete`, {
        motivo_cierre: motivoCierre.trim() || undefined,
      })
      toast.success('Visita completada')
      setShowCompleteModal(false)
      setMotivoCierre('')
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
        <PageHeader title="Visita" onBack={() => goBackTo('/')} />
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
        <PageHeader title="Visita" onBack={() => goBackTo('/')} />
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
  const entregas = visit.entregas ?? []
  const mantenimientos = visit.mantenimientos ?? []
  const cambiosImpresoras = visit.cambios_impresoras ?? []
  const totalActividades =
    readings.length + entregas.length + mantenimientos.length + cambiosImpresoras.length
  const capturedIds = new Set(readings.map((r) => String(r.impresora_id)))
  const queuedKeys = new Set(
    queueItems
      .filter(
        (i): i is ReadingQueueItem => i.type === 'reading' && i.estado === 'pendiente'
      )
      .map((i) => `${i.payload.visita_id}:${i.payload.impresora_id}`)
  )
  const errorKeys = new Set(
    queueItems
      .filter(
        (i): i is ReadingQueueItem => i.type === 'reading' && i.estado === 'error'
      )
      .map((i) => `${i.payload.visita_id}:${i.payload.impresora_id}`)
  )
  const progress =
    printers.length > 0
      ? printers.filter(
          (p) =>
            capturedIds.has(p.impresora_id) || queuedKeys.has(`${visit.id}:${p.impresora_id}`)
        ).length
      : 0
  const tipo = visit.tipo_visita
  const client = visit.client
  const hasContacto = Boolean(
    client &&
      (client.nombre_contacto ||
        client.telefono ||
        client.correo ||
        client.direccion_instalacion)
  )

  const motivoCierreValido = motivoCierre.trim().length >= 5
  const canConfirmComplete = totalActividades > 0 || motivoCierreValido

  return (
    <div>
      <PageHeader title={visit.cliente_nombre ?? `Cliente #${visit.cliente_id}`} onBack={() => goBackTo('/')} />
      <Page>
        <Card className="mb-5">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {tipo && (
              <Badge tone={tipoVisitaTone[tipo]}>
                {tipoVisitaIcon[tipo]} Motivo: {tipo}
              </Badge>
            )}
            {estado && <Badge tone={estadoVisitaTone[estado]}>{estado}</Badge>}
          </div>
          <p className="text-sm text-gray-600">
            📅 <span className="capitalize">{formatDateLong(visit.fecha_programada)}</span>
          </p>
          {hasContacto && client && (
            <div>
              {client.nombre_contacto && (
                <p className="mt-1 text-sm text-gray-600">👤 {client.nombre_contacto}</p>
              )}
              {client.telefono && (
                <a
                  href={`tel:${telHref(client.telefono)}`}
                  className="mt-1 block text-sm font-medium text-blue-600"
                >
                  📱 {client.telefono}
                </a>
              )}
              {client.correo && (
                <a
                  href={`mailto:${client.correo}`}
                  className="mt-1 block text-sm font-medium text-blue-600"
                >
                  📧 {client.correo}
                </a>
              )}
              {client.direccion_instalacion && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(client.direccion_instalacion)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block text-sm font-medium text-blue-600"
                >
                  📍 {client.direccion_instalacion}
                </a>
              )}
            </div>
          )}
          {visit.notas && <p className="mt-2 text-sm italic text-gray-500">"{visit.notas}"</p>}
          {visit.motivo_cierre && (
            <p className="mt-2 rounded-lg bg-gray-50 p-2 text-sm text-gray-600">
              🚪 Cierre: {visit.motivo_cierre}
            </p>
          )}
        </Card>

        {actionError && (
          <div className="mb-4">
            <Banner tone="error">{actionError}</Banner>
          </div>
        )}

        <section className="mb-6">
          <SectionTitle hint={isEditable ? '👆 Toca una impresora para ver acciones disponibles' : undefined}>
            Impresoras del contrato {printers.length > 0 && `(${progress}/${printers.length})`}
          </SectionTitle>
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
                  isEditable
                    ? () => navigate(`/visita/${visitId}/impresora/${p.impresora_id}`)
                    : undefined
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
                  ) : isEditable ? (
                    <Badge tone="blue">Ver acciones →</Badge>
                  ) : null}
                </div>
              </Card>
            )
          })}
        </section>

        {isEditable && (
          <section className="mb-6">
            <SectionTitle hint="No requieren seleccionar una impresora">
              Acciones de visita
            </SectionTitle>
            <div className="space-y-2.5">
              <Button
                variant="secondary"
                block
                disabled={!canInstalar || !visit.contrato_id}
                onClick={() => navigate(`/visita/${visitId}/instalacion`)}
              >
                📥 Instalar impresora
              </Button>
              <Button
                variant="secondary"
                block
                disabled={!canInsumos}
                onClick={() => navigate(`/visita/${visitId}/entrega`)}
              >
                📦 Entregar insumos
              </Button>
            </div>
          </section>
        )}

        {entregas.length > 0 && (
          <section className="mb-6">
            <SectionTitle>Insumos entregados</SectionTitle>
            {entregas.map((d) => (
              <Card key={d.id} className="mb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-800">
                      {d.article?.nombre ?? `Artículo #${d.articulo_id}`}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {d.article?.marca ?? '-'} · {d.article?.modelo_sku ?? '-'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-sm text-gray-600">
                    <p>×{d.cantidad}</p>
                    <p className="text-xs">{formatMoney(Number(d.subtotal ?? 0))}</p>
                  </div>
                </div>
              </Card>
            ))}
          </section>
        )}

        {mantenimientos.length > 0 && (
          <section className="mb-6">
            <SectionTitle>Órdenes de mantenimiento</SectionTitle>
            {mantenimientos.map((m) => (
              <Card key={m.id} className="mb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-800">
                      🔧 {m.printer ? `${m.printer.marca} ${m.printer.modelo}` : `Impresora #${m.impresora_id}`}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {m.tipo_mantto ?? '-'} · {m.fecha ?? '-'}
                    </p>
                  </div>
                  {m.estado && <Badge tone="violet">{m.estado}</Badge>}
                </div>
                {m.desc_problema && (
                  <p className="mt-2 text-sm text-gray-600">{m.desc_problema}</p>
                )}
              </Card>
            ))}
          </section>
        )}

        {cambiosImpresoras.length > 0 && (
          <section className="mb-6">
            <SectionTitle>Cambios de impresoras</SectionTitle>
            {cambiosImpresoras.map((c, i) => (
              <Card key={`${c.evento}-${i}`} className="mb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-800">
                      {c.impresora ? `${c.impresora.marca} ${c.impresora.modelo}` : 'Impresora'}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Serie: {c.impresora?.num_serie ?? '-'}
                    </p>
                  </div>
                  <Badge tone={c.evento === 'ASIGNACION_CONTRATO' ? 'emerald' : 'orange'}>
                    {eventoCambioLabels[c.evento] ?? c.evento}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-gray-400">{formatDateTime(c.fecha)}</p>
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
                onClick={() => {
                  setMotivoCierre('')
                  setActionError(null)
                  setShowCompleteModal(true)
                }}
                disabled={busy !== null}
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

      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-gray-800">Completar visita</h3>

            <div className="mt-3 space-y-1 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
              <p>📊 Lecturas registradas: {readings.length}</p>
              <p>📦 Insumos entregados: {entregas.length}</p>
              <p>🔧 Órdenes de mantenimiento: {mantenimientos.length}</p>
              <p>🖨️ Cambios de impresoras: {cambiosImpresoras.length}</p>
            </div>

            {totalActividades === 0 ? (
              <div className="mt-4">
                <Field
                  label="Motivo de cierre *"
                  help="La visita no tiene actividades registradas; el motivo es obligatorio."
                  error={
                    motivoCierre.trim().length > 0 && !motivoCierreValido
                      ? 'El motivo debe tener al menos 5 caracteres'
                      : null
                  }
                >
                  <TextArea
                    rows={3}
                    placeholder="Describe por qué se cierra la visita sin actividades..."
                    value={motivoCierre}
                    onChange={(e) => setMotivoCierre(e.target.value)}
                  />
                </Field>
              </div>
            ) : (
              <p className="mt-3 text-xs text-gray-400">
                Hay actividades registradas: no se requiere motivo de cierre.
              </p>
            )}

            {actionError && (
              <div className="mt-3">
                <Banner tone="error">{actionError}</Banner>
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <Button
                variant="secondary"
                block
                onClick={() => setShowCompleteModal(false)}
                disabled={busy === 'complete'}
              >
                Cancelar
              </Button>
              <Button
                block
                disabled={!canConfirmComplete}
                loading={busy === 'complete'}
                onClick={() => void handleComplete()}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
