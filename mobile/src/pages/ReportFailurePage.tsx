import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useOnline } from '../hooks/useOnline'
import { useToast } from '../components/Toast'
import api, { apiErrorMessage } from '../lib/api'
import { formatNumber, todayISO } from '../lib/format'
import type { Visit } from '../types/api'
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
} from '../components/ui'

export default function ReportFailurePage() {
  const { id } = useParams()
  const visitId = Number(id)
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const toast = useToast()
  const online = useOnline()

  const canReport = hasPermission('inventario.mantenimiento')

  const [visit, setVisit] = useState<Visit | null>(null)
  const [loadingVisit, setLoadingVisit] = useState(true)
  const [visitError, setVisitError] = useState<string | null>(null)
  const [printerId, setPrinterId] = useState<string | null>(null)
  const [descProblema, setDescProblema] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadingVisit(true)
    api
      .get<Visit>(`/visits/${visitId}`)
      .then((res) => {
        if (!cancelled) {
          setVisit(res.data)
          setVisitError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) setVisitError(apiErrorMessage(e))
      })
      .finally(() => {
        if (!cancelled) setLoadingVisit(false)
      })
    return () => {
      cancelled = true
    }
  }, [visitId])

  const printers = visit?.impresoras ?? []
  const descValida = descProblema.trim().length >= 5
  const canSubmit = canReport && printerId !== null && descValida && online && !submitting

  async function handleSubmit() {
    if (!canSubmit || printerId === null) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await api.post('/maintenance-orders', {
        impresora_id: Number(printerId),
        fecha: todayISO(),
        tipo_mantto: 'CORRECTIVO',
        desc_problema: descProblema.trim(),
        visita_id: visitId,
      })
      toast.success('Falla reportada: orden correctiva creada')
      navigate(`/visita/${visitId}`)
    } catch (e) {
      setSubmitError(apiErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const title = visit ? (visit.cliente_nombre ?? 'Reportar falla') : 'Reportar falla'

  return (
    <div>
      <PageHeader title={title} onBack={() => navigate(`/visita/${visitId}`)} />
      <Page>
        {!canReport && (
          <Banner tone="error">
            No tienes permiso para reportar fallas (se requiere el permiso de mantenimiento).
          </Banner>
        )}
        {!online && canReport && (
          <div className="mb-4">
            <Banner tone="warn">
              📴 Sin conexión. Reportar una falla requiere conexión a internet.
            </Banner>
          </div>
        )}

        {loadingVisit && <SkeletonCard />}

        {visitError && (
          <div className="mb-4">
            <Banner tone="error">{visitError}</Banner>
          </div>
        )}

        {visit && !canReport && (
          <p className="text-xs text-gray-400">
            La visita no se modifica: la orden correctiva se gestiona desde el panel web.
          </p>
        )}

        {canReport && visit && (
          <>
            <SectionTitle hint="Selecciona la impresora con la falla">Impresoras del contrato</SectionTitle>
            {printers.length === 0 && (
              <EmptyState icon="🖨️" text="El contrato no tiene impresoras activas que reportar" />
            )}
            {printers.map((p) => (
              <Card
                key={p.id}
                className={`mb-3 ${printerId === p.impresora_id ? '!border-blue-500 ring-1 ring-blue-500' : ''}`}
                onClick={() => setPrinterId(p.impresora_id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-800">
                      {p.marca} {p.modelo}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">Serie: {p.numero_serie ?? '-'}</p>
                    <p className="text-xs text-gray-400">
                      Última lectura: {formatNumber(p.lectura_anterior)}
                    </p>
                  </div>
                  {printerId === p.impresora_id && <span className="text-blue-600">✓</span>}
                </div>
              </Card>
            ))}

            {printerId !== null && (
              <div className="mt-5">
                <Field
                  label="Descripción del problema *"
                  help="Se creará una orden de mantenimiento CORRECTIVO vinculada a esta visita."
                  error={
                    descProblema.trim().length > 0 && !descValida
                      ? 'Describe la falla con al menos 5 caracteres'
                      : null
                  }
                >
                  <TextArea
                    rows={4}
                    placeholder="Describe la falla observada (atasco, error en pantalla, mala calidad de impresión...)"
                    value={descProblema}
                    onChange={(e) => setDescProblema(e.target.value)}
                  />
                </Field>
              </div>
            )}

            {submitError && (
              <div className="mb-4">
                <Banner tone="error">{submitError}</Banner>
              </div>
            )}

            <Button
              block
              className="mt-4"
              disabled={!canSubmit}
              loading={submitting}
              onClick={() => void handleSubmit()}
            >
              Reportar falla
            </Button>

            <div className="mt-4">
              <Banner tone="info">
                La impresora pasará a <strong>EN_MANTENIMIENTO</strong> hasta que la orden se
                complete desde el panel web. Esta visita no se auto-completa.
              </Banner>
            </div>
          </>
        )}

        {(visit?.mantenimientos ?? []).length > 0 && (
          <section className="mt-8">
            <SectionTitle>Ya reportado en esta visita</SectionTitle>
            {(visit?.mantenimientos ?? []).map((m) => (
              <Card key={m.id} className="mb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-800">
                      🔧 {m.printer ? `${m.printer.marca} ${m.printer.modelo}` : `Impresora #${m.impresora_id}`}
                    </p>
                    {m.desc_problema && (
                      <p className="mt-0.5 text-xs text-gray-500">{m.desc_problema}</p>
                    )}
                  </div>
                  {m.estado && <Badge tone="violet">{m.estado}</Badge>}
                </div>
              </Card>
            ))}
          </section>
        )}
      </Page>
    </div>
  )
}
