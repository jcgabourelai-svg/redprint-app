import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import PrinterColorDot from '../components/PrinterColorDot'
import { useGoBack } from '../hooks/useGoBack'
import { useOnline } from '../hooks/useOnline'
import { useSyncQueue } from '../hooks/useSyncQueue'
import { useToast } from '../components/Toast'
import api, { apiErrorMessage, isNetworkError } from '../lib/api'
import { SyncManager } from '../lib/sync'
import { compressImage } from '../lib/photo'
import { formatDateLong, formatMoney, formatNumber, todayISO } from '../lib/format'
import type { ReadingPayload, ReadingQueueItem } from '../lib/db'
import type { StoreReadingResponse, Visit } from '../types/api'
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
  TextInput,
} from '../components/ui'

export default function CaptureReadingPage() {
  const { id, printerId } = useParams()
  const visitId = Number(id)
  const goBackTo = useGoBack()
  const { hasPermission } = useAuth()
  const toast = useToast()
  const online = useOnline()
  const { items: queueItems } = useSyncQueue()

  const [visit, setVisit] = useState<Visit | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [valor, setValor] = useState('')
  const [justificacion, setJustificacion] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [forceJustification, setForceJustification] = useState(false)
  const [result, setResult] = useState<StoreReadingResponse | null>(null)

  const canLecturas = hasPermission('operaciones.lecturas')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .get<Visit>(`/visits/${visitId}`)
      .then((res) => {
        if (!cancelled) {
          setVisit(res.data)
          setError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) setError(apiErrorMessage(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [visitId])

  useEffect(() => {
    if (!navigator.geolocation) return
    let cancelled = false
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!cancelled) setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {},
      { timeout: 10000, maximumAge: 60000 }
    )
    return () => {
      cancelled = true
    }
  }, [])

  const printer = useMemo(
    () => visit?.impresoras?.find((p) => p.impresora_id === printerId) ?? null,
    [visit, printerId]
  )
  const serverReading = useMemo(
    () => visit?.readings?.find((r) => String(r.impresora_id) === printerId) ?? null,
    [visit, printerId]
  )
  const queueItem = useMemo(
    () =>
      queueItems.find(
        (i): i is ReadingQueueItem =>
          i.type === 'reading' &&
          i.payload.visita_id === visitId &&
          String(i.payload.impresora_id) === printerId
      ) ?? null,
    [queueItems, visitId, printerId]
  )

  const valorNum = valor.trim() === '' ? null : Number.parseInt(valor, 10)
  const anomaly = useMemo(
    () => (valorNum !== null && printer ? valorNum < printer.lectura_anterior : false),
    [valorNum, printer]
  )
  const showJustification = anomaly || forceJustification
  const pagesPreview = anomaly || valorNum === null || !printer ? null : valorNum - printer.lectura_anterior
  const canSubmit =
    canLecturas &&
    valorNum !== null &&
    valorNum >= 0 &&
    Number.isFinite(valorNum) &&
    (!showJustification || justificacion.trim().length >= 5) &&
    !submitting &&
    !result

  async function handlePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoBusy(true)
    try {
      const dataUri = await compressImage(file)
      setPhoto(dataUri)
    } catch {
      toast.error('No se pudo procesar la foto')
    } finally {
      setPhotoBusy(false)
    }
  }

  async function enqueueOffline(payload: ReadingPayload) {
    await SyncManager.enqueueReading(payload)
    toast.info('Guardada localmente, pendiente de sincronizar')
    goBackTo(`/visita/${visitId}`, 2)
  }

  async function handleSubmit() {
    if (!canSubmit || valorNum === null) return
    setSubmitting(true)
    setFormError(null)
    const payload: ReadingPayload = {
      visita_id: visitId,
      impresora_id: Number(printerId),
      contrato_id: visit?.contrato_id ?? null,
      fecha: todayISO(),
      valor_contador: valorNum,
      foto_evidencia: photo,
      justificacion_anomalia: showJustification ? justificacion.trim() : null,
      ubicacion_lat: gps?.lat ?? null,
      ubicacion_lng: gps?.lng ?? null,
    }
    if (!navigator.onLine) {
      await enqueueOffline(payload)
      setSubmitting(false)
      return
    }
    try {
      const res = await api.post<StoreReadingResponse>('/readings', payload)
      setResult(res.data)
      toast.success(res.data.reading.es_anomalia ? 'Lectura guardada con justificación' : 'Lectura guardada')
    } catch (err) {
      if (isNetworkError(err)) {
        await enqueueOffline(payload)
      } else {
        const msg = apiErrorMessage(err)
        if (msg.toLowerCase().includes('justificacion')) setForceJustification(true)
        setFormError(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Lectura" onBack={() => goBackTo(`/visita/${visitId}/impresora/${printerId}`)} />
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
        <PageHeader title="Lectura" onBack={() => goBackTo(`/visita/${visitId}/impresora/${printerId}`)} />
        <Page>
          <Banner tone="error">{error ?? 'No se pudo cargar la visita'}</Banner>
        </Page>
      </div>
    )
  }

  if (!printer) {
    return (
      <div>
        <PageHeader title="Lectura" onBack={() => goBackTo(`/visita/${visitId}/impresora/${printerId}`)} />
        <Page>
          <EmptyState icon="🖨️" text="La impresora no pertenece al contrato de esta visita" />
        </Page>
      </div>
    )
  }

  const backToVisit = () => goBackTo(`/visita/${visitId}`, 2)
  const backToPrinter = () => goBackTo(`/visita/${visitId}/impresora/${printerId}`)

  if (result) {
    return (
      <div>
        <PageHeader title={`${printer.marca} ${printer.modelo}`} onBack={backToVisit} />
        <Page>
          <Card className="mb-4 border-emerald-200 bg-emerald-50">
            <p className="text-sm font-semibold text-emerald-800">✅ Lectura registrada</p>
            <div className="mt-2 space-y-1 text-sm text-emerald-900">
              <p>
                Contador actual: <strong>{formatNumber(result.reading.valor_contador)}</strong>
              </p>
              <p>
                Páginas del periodo:{' '}
                <strong>{formatNumber(result.reading.paginas_periodo ?? result.paginas_consumidas)}</strong>
              </p>
              <p>
                Consumo estimado: <strong>{formatMoney(result.monto_estimado)}</strong>
              </p>
              {result.reading.es_anomalia && (
                <p className="text-xs text-amber-700">
                  ⚠ Registrada como lectura anómala justificada
                </p>
              )}
            </div>
          </Card>
          <Button block onClick={backToVisit}>
            Volver a la visita
          </Button>
        </Page>
      </div>
    )
  }

  if (serverReading) {
    return (
      <div>
        <PageHeader title={`${printer.marca} ${printer.modelo}`} onBack={backToVisit} />
        <Page>
          <Card className="mb-4">
            <div className="mb-2">
              <Badge tone="emerald">✓ Lectura ya capturada</Badge>
            </div>
            <p className="text-sm text-gray-600">Fecha: {serverReading.fecha}</p>
            <p className="mt-1 text-sm text-gray-600">
              Contador: {formatNumber(serverReading.valor_contador)}
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Páginas del periodo: {formatNumber(serverReading.paginas_periodo)}
            </p>
            {serverReading.es_anomalia && (
              <p className="mt-2 text-xs text-amber-700">
                Anómala: {serverReading.justificacion_anomalia ?? 'sin justificación'}
              </p>
            )}
          </Card>
          <Button variant="secondary" block onClick={backToVisit}>
            Volver a la visita
          </Button>
        </Page>
      </div>
    )
  }

  if (queueItem) {
    const isFailed = queueItem.estado === 'error'
    return (
      <div>
        <PageHeader title={`${printer.marca} ${printer.modelo}`} onBack={backToVisit} />
        <Page>
          <Card className={`mb-4 ${isFailed ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
            <p className="mb-2 text-sm font-semibold text-gray-800">
              {isFailed ? '⚠ Error de sincronización' : '⟳ Pendiente de sincronizar'}
            </p>
            <p className="text-sm text-gray-600">
              Contador capturado: {formatNumber(queueItem.payload.valor_contador)}
            </p>
            <p className="mt-1 text-sm text-gray-600">Fecha: {queueItem.payload.fecha}</p>
            {isFailed && queueItem.error_msg && (
              <p className="mt-2 text-sm text-red-700">{queueItem.error_msg}</p>
            )}
          </Card>
          {isFailed ? (
            <div className="space-y-3">
              <Button
                block
                onClick={() => {
                  void SyncManager.retry(queueItem.id)
                  toast.info('Reintentando sincronización')
                }}
              >
                Reintentar sincronización
              </Button>
              <Button
                variant="danger"
                block
                onClick={() => {
                  void SyncManager.discard(queueItem.id)
                  toast.info('Lectura descartada, puedes capturar de nuevo')
                }}
              >
                Descartar y capturar de nuevo
              </Button>
            </div>
          ) : (
            <Banner tone="info">
              Esta lectura se enviará automáticamente cuando haya conexión. No puedes capturar otra
              lectura para esta impresora.
            </Banner>
          )}
          <div className="mt-4">
            <Button variant="secondary" block onClick={backToVisit}>
              Volver a la visita
            </Button>
          </div>
        </Page>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={printer.alias ?? `${printer.marca} ${printer.modelo}`}
        onBack={backToPrinter}
      />
      <Page>
        {visit.fecha_programada !== null && visit.fecha_programada > todayISO() && (
          <div className="mb-4">
            <Banner tone="warn">
              Visita adelantada: está programada para el {formatDateLong(visit.fecha_programada)}. Si
              el cliente no corresponde a esta visita, reprograma o crea una nueva.
            </Banner>
          </div>
        )}
        {!online && (
          <div className="mb-4">
            <Banner tone="warn">
              📴 Sin conexión. La lectura se guardará localmente y se sincronizará después.
            </Banner>
          </div>
        )}
        {!canLecturas && (
          <div className="mb-4">
            <Banner tone="error">No tienes permiso de capturar lecturas</Banner>
          </div>
        )}

        <Card className="mb-4">
          {printer.alias && (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
              {printer.color && <PrinterColorDot color={printer.color} />}
              {printer.alias}
            </p>
          )}
          <p className={`text-xs text-gray-400 ${printer.alias ? 'mt-0.5' : ''}`}>
            {printer.alias && `${printer.marca} ${printer.modelo} · `}Serie: {printer.numero_serie ?? '-'}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Última lectura: <strong>{formatNumber(printer.lectura_anterior)}</strong>
          </p>
          <p className="text-xs text-gray-400">
            {printer.fecha_lectura_anterior
              ? `Registrada el ${printer.fecha_lectura_anterior}`
              : 'Sin lecturas previas (se usará la lectura inicial del contrato)'}
          </p>
        </Card>

        <SectionTitle>Captura de lectura</SectionTitle>

        <Field label="Contador actual" help="Ingresa el valor que muestra el contador de la impresora">
          <TextInput
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="0"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            disabled={!canLecturas}
          />
        </Field>

        {anomaly && (
          <div className="mb-4">
            <Banner tone="warn">
              ⚠️ El contador actual es menor a la última lectura ({formatNumber(printer.lectura_anterior)}).
              Se requiere una justificación para registrar la anomalía.
            </Banner>
          </div>
        )}

        {pagesPreview !== null && pagesPreview > 0 && (
          <Card className="mb-4 bg-blue-50">
            <p className="text-sm font-semibold text-blue-800">
              Páginas del periodo (estimado): {formatNumber(pagesPreview)}
            </p>
            <p className="text-xs text-blue-600">El monto se calcula al guardar</p>
          </Card>
        )}

        {showJustification && (
          <Field
            label="Justificación de anomalía *"
            help="Explica la causa (cambio de tambor/toner, reinicio de contador, error de lectura...)"
            error={
              anomaly && justificacion.trim().length > 0 && justificacion.trim().length < 5
                ? 'La justificación debe tener al menos 5 caracteres'
                : null
            }
          >
            <TextArea
              rows={3}
              placeholder="Describe el motivo de la lectura anómala..."
              value={justificacion}
              onChange={(e) => setJustificacion(e.target.value)}
            />
          </Field>
        )}

        {formError && (
          <div className="mb-4">
            <Banner tone="error">{formError}</Banner>
          </div>
        )}

        <div className="mb-4 space-y-3">
          {photo ? (
            <div>
              <img
                src={photo}
                alt="Foto del contador"
                className="max-h-48 w-full rounded-xl object-cover"
              />
              <button
                onClick={() => setPhoto(null)}
                className="mt-2 text-xs font-semibold text-red-600"
              >
                Quitar foto
              </button>
            </div>
          ) : (
            <>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                id="foto-contador"
                onChange={(e) => void handlePhoto(e)}
              />
              <Button
                variant="secondary"
                block
                loading={photoBusy}
                onClick={() => document.getElementById('foto-contador')?.click()}
                disabled={!canLecturas}
              >
                📷 Tomar foto del contador
              </Button>
            </>
          )}
        </div>

        <Button
          block
          disabled={!canSubmit}
          loading={submitting}
          onClick={() => void handleSubmit()}
        >
          {online ? 'Guardar lectura' : 'Guardar (se sincronizará después)'}
        </Button>
      </Page>
    </div>
  )
}
