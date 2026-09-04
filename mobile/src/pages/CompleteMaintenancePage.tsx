import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useGoBack } from '../hooks/useGoBack'
import { useOnline } from '../hooks/useOnline'
import { useToast } from '../components/Toast'
import api, { apiErrorMessage } from '../lib/api'
import type { MaintenanceOrder, Visit } from '../types/api'
import {
  Banner,
  Button,
  Card,
  Field,
  Page,
  PageHeader,
  SkeletonCard,
  TextArea,
  TextInput,
} from '../components/ui'

export default function CompleteMaintenancePage() {
  const { id, ordenId } = useParams()
  const visitId = Number(id)
  const orderId = Number(ordenId)
  const goBackTo = useGoBack()
  const { hasPermission } = useAuth()
  const toast = useToast()
  const online = useOnline()

  const canComplete = hasPermission('inventario.mantenimiento')

  const [visit, setVisit] = useState<Visit | null>(null)
  const [order, setOrder] = useState<MaintenanceOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [trabajo, setTrabajo] = useState('')
  const [costo, setCosto] = useState('')
  const [contador, setContador] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      api.get<Visit>(`/visits/${visitId}`).then((r) => r.data),
      api.get<MaintenanceOrder>(`/maintenance-orders/${orderId}`).then((r) => r.data),
    ])
      .then(([v, o]) => {
        if (cancelled) return
        setVisit(v)
        setOrder(o)
        setTrabajo(o.trabajo_realizado ?? '')
        setLoadError(null)
      })
      .catch((e) => {
        if (!cancelled) setLoadError(apiErrorMessage(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [visitId, orderId])

  const contadorNum = contador.trim() === '' ? null : Number.parseInt(contador, 10)
  const contadorValido =
    contadorNum === null || (Number.isFinite(contadorNum) && contadorNum >= 0)
  const trabajoValido = trabajo.trim().length >= 5
  const costoNum = costo.trim() === '' ? null : Number.parseFloat(costo)
  const costoValido = costoNum === null || (Number.isFinite(costoNum) && costoNum >= 0)

  const yaNoProgramada = order != null && order.estado !== 'PROGRAMADA'
  const canSubmit =
    canComplete && order != null && !yaNoProgramada && trabajoValido && contadorValido && costoValido && online && !submitting

  async function handleSubmit() {
    if (!canSubmit || order === null) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await api.post(`/maintenance-orders/${order.id}/complete`, {
        trabajo_realizado: trabajo.trim(),
        costo_mano_obra: costoNum ?? 0,
        contador_impresora: contadorNum,
      })
      toast.success('Orden de mantenimiento completada')
      goBackTo(`/visita/${visitId}`, 2)
    } catch (e) {
      setSubmitError(apiErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const title = visit ? (visit.cliente_nombre ?? 'Completar orden') : 'Completar orden'
  const goBack = () => goBackTo(`/visita/${visitId}`)

  return (
    <div>
      <PageHeader title={title} onBack={goBack} />
      <Page>
        {!canComplete && (
          <Banner tone="error">
            No tienes permiso para completar órdenes de mantenimiento.
          </Banner>
        )}

        {!online && canComplete && (
          <div className="mb-4">
            <Banner tone="warn">
              📴 Sin conexión. Completar una orden requiere conexión a internet.
            </Banner>
          </div>
        )}

        {loading && <SkeletonCard />}

        {loadError && (
          <div className="mb-4">
            <Banner tone="error">{loadError}</Banner>
          </div>
        )}

        {order && !loading && (
          <>
            <Card className="mb-4">
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-800">
                  🔧 Orden #{order.id} —{' '}
                  {order.printer
                    ? `${order.printer.marca} ${order.printer.modelo}`
                    : `Impresora #${order.impresora_id}`}
                </p>
                {order.desc_problema && (
                  <p className="mt-0.5 text-xs text-gray-500">{order.desc_problema}</p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  {order.tipo_mantto ?? '-'} · {order.fecha ?? '-'}
                </p>
              </div>
            </Card>

            {yaNoProgramada && (
              <div className="mb-4">
                <Banner tone="warn">
                  Esta orden ya no está PROGRAMADA (estado actual: {order.estado ?? '-'}); no se
                  puede completar de nuevo.
                </Banner>
              </div>
            )}

            <div className="space-y-4">
              <Field
                label="Trabajo realizado *"
                error={
                  trabajo.trim().length > 0 && !trabajoValido
                    ? 'Describe el trabajo con al menos 5 caracteres'
                    : null
                }
              >
                <TextArea
                  rows={4}
                  placeholder="Ej. Cambio de fusor y limpieza de rodillos"
                  value={trabajo}
                  onChange={(e) => setTrabajo(e.target.value)}
                />
              </Field>

              <Field label="Costo de mano de obra ($)">
                <TextInput
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={costo}
                  onChange={(e) => setCosto(e.target.value)}
                />
              </Field>

              <Field
                label="Contador al terminar (opcional)"
                help="Actualiza el contador de la serie con las páginas de pruebas del taller: así no se facturan al cliente en el re-ingreso. No puede ser menor al registrado."
                error={!contadorValido ? 'El contador debe ser un número entero no negativo' : null}
              >
                <TextInput
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="Contador actual de la impresora"
                  value={contador}
                  onChange={(e) => setContador(e.target.value)}
                />
              </Field>

              {submitError && (
                <div className="mb-4">
                  <Banner tone="error">{submitError}</Banner>
                </div>
              )}

              <Button
                block
                disabled={!canSubmit}
                loading={submitting}
                onClick={() => void handleSubmit()}
              >
                Completar orden
              </Button>
            </div>
          </>
        )}
      </Page>
    </div>
  )
}
