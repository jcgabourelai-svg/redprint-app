import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useGoBack } from '../hooks/useGoBack'
import { useOnline } from '../hooks/useOnline'
import { useToast } from '../components/Toast'
import api, { apiErrorMessage } from '../lib/api'
import { compressImage } from '../lib/photo'
import { formatNumber, todayISO } from '../lib/format'
import type { Severidad, TipoProblema, Visit } from '../types/api'
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

const TIPOS_PROBLEMA: { value: TipoProblema; label: string; icon: string }[] = [
  { value: 'NO_IMPRIME', label: 'No imprime', icon: '🖨️' },
  { value: 'CALIDAD_DEFICIENTE', label: 'Calidad deficiente', icon: '📄' },
  { value: 'ATASCOS', label: 'Atascos', icon: '📎' },
  { value: 'ERROR_PANTALLA', label: 'Error en pantalla', icon: '⚠️' },
  { value: 'OTRO', label: 'Otro', icon: '❓' },
]

const SEVERIDADES: { value: Severidad; label: string; icon: string; selectedClasses: string }[] = [
  { value: 'BAJA', label: 'Baja', icon: '🟢', selectedClasses: 'border-emerald-500 bg-emerald-100' },
  { value: 'MEDIA', label: 'Media', icon: '🟡', selectedClasses: 'border-amber-500 bg-amber-100' },
  { value: 'ALTA', label: 'Alta', icon: '🔴', selectedClasses: 'border-red-500 bg-red-100' },
  { value: 'CRITICA', label: 'Crítica', icon: '⚠️', selectedClasses: 'border-red-600 bg-red-100' },
]

const tipoProblemaLabels: Record<string, string> = {
  NO_IMPRIME: 'No imprime',
  CALIDAD_DEFICIENTE: 'Calidad deficiente',
  ATASCOS: 'Atascos',
  ERROR_PANTALLA: 'Error en pantalla',
  OTRO: 'Otro',
}

const severidadLabels: Record<string, string> = {
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta',
  CRITICA: 'Crítica',
}

const severidadTone: Record<string, 'emerald' | 'amber' | 'red'> = {
  BAJA: 'emerald',
  MEDIA: 'amber',
  ALTA: 'red',
  CRITICA: 'red',
}

export default function ReportFailurePage() {
  const { id } = useParams()
  const visitId = Number(id)
  const goBackTo = useGoBack()
  const [searchParams] = useSearchParams()
  const { hasPermission } = useAuth()
  const toast = useToast()
  const online = useOnline()

  const canReport = hasPermission('inventario.mantenimiento')

  const [visit, setVisit] = useState<Visit | null>(null)
  const [loadingVisit, setLoadingVisit] = useState(true)
  const [visitError, setVisitError] = useState<string | null>(null)
  const [printerId, setPrinterId] = useState<string | null>(searchParams.get('impresora'))
  const [tipoProblema, setTipoProblema] = useState<TipoProblema | null>(null)
  const [severidad, setSeveridad] = useState<Severidad | null>(null)
  const [descProblema, setDescProblema] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
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
  const selectedPrinter = printers.find((p) => p.impresora_id === printerId) ?? null
  const descValida = descProblema.trim().length >= 5
  const canSubmit =
    canReport &&
    printerId !== null &&
    selectedPrinter !== null &&
    tipoProblema !== null &&
    severidad !== null &&
    descValida &&
    online &&
    !submitting

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

  async function handleSubmit() {
    if (!canSubmit || printerId === null || tipoProblema === null || severidad === null) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await api.post('/maintenance-orders', {
        impresora_id: Number(printerId),
        fecha: todayISO(),
        tipo_mantto: 'CORRECTIVO',
        desc_problema: descProblema.trim(),
        tipo_problema: tipoProblema,
        severidad: severidad,
        foto_evidencia: photo,
        visita_id: visitId,
      })
      toast.success('Falla reportada: orden correctiva creada')
      goBackTo(`/visita/${visitId}`, 2)
    } catch (e) {
      setSubmitError(apiErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const title = visit ? (visit.cliente_nombre ?? 'Reportar falla') : 'Reportar falla'
  const printerParam = searchParams.get('impresora')
  const goBack = () =>
    goBackTo(
      printerParam ? `/visita/${visitId}/impresora/${printerParam}` : `/visita/${visitId}`
    )

  return (
    <div>
      <PageHeader title={title} onBack={goBack} />
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
            {selectedPrinter ? (
              <div className="mb-5 rounded-xl bg-gray-50 px-4 py-3">
                <p className="text-base font-semibold text-gray-800">
                  {selectedPrinter.marca} {selectedPrinter.modelo}
                </p>
                <p className="mt-0.5 text-[13px] text-gray-500">
                  Serie: {selectedPrinter.numero_serie ?? '-'}
                </p>
                {printers.length > 1 && (
                  <button
                    className="mt-1.5 text-xs font-semibold text-blue-600 active:text-blue-700"
                    onClick={() => setPrinterId(null)}
                  >
                    Cambiar impresora
                  </button>
                )}
              </div>
            ) : (
              <>
                <SectionTitle hint="Selecciona la impresora con la falla">
                  Impresoras del contrato
                </SectionTitle>
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
              </>
            )}

            {selectedPrinter !== null && (
              <>
                <div className="mt-5">
                  <SectionTitle>Tipo de problema</SectionTitle>
                  <div className="grid grid-cols-3 gap-2">
                    {TIPOS_PROBLEMA.map((t) => {
                      const selected = tipoProblema === t.value
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setTipoProblema(t.value)}
                          className={`flex min-h-[72px] flex-col items-center justify-center rounded-xl border p-2 text-center transition-colors ${
                            selected
                              ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                              : 'border-gray-200 bg-white active:bg-gray-50'
                          }`}
                        >
                          <span className="text-[22px] leading-none">{t.icon}</span>
                          <span className="mt-1 text-[12px] font-medium leading-tight text-gray-800">
                            {t.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="mt-5">
                  <SectionTitle>Severidad</SectionTitle>
                  <div className="flex gap-2">
                    {SEVERIDADES.map((s) => {
                      const selected = severidad === s.value
                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => setSeveridad(s.value)}
                          className={`flex-1 rounded-xl border-2 px-1 py-2.5 text-center transition-transform ${
                            selected ? `${s.selectedClasses} scale-[1.03]` : 'border-gray-200 bg-white active:bg-gray-50'
                          }`}
                        >
                          <span className="block text-xl leading-none">{s.icon}</span>
                          <span
                            className={`mt-1 block text-xs font-semibold ${
                              selected && s.value === 'CRITICA' ? 'text-red-700' : 'text-gray-800'
                            }`}
                          >
                            {s.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

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

                <div className="mt-4">
                  {photo ? (
                    <div>
                      <img
                        src={photo}
                        alt="Foto de la falla"
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
                        id="foto-falla"
                        onChange={(e) => void handlePhoto(e)}
                      />
                      <Button
                        variant="secondary"
                        block
                        loading={photoBusy}
                        onClick={() => document.getElementById('foto-falla')?.click()}
                      >
                        📷 Adjuntar foto (opcional)
                      </Button>
                    </>
                  )}
                </div>
              </>
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
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    {m.tipo_problema && (
                      <Badge tone="blue">{tipoProblemaLabels[m.tipo_problema] ?? m.tipo_problema}</Badge>
                    )}
                    {m.severidad && (
                      <Badge tone={severidadTone[m.severidad] ?? 'gray'}>
                        {severidadLabels[m.severidad] ?? m.severidad}
                      </Badge>
                    )}
                    {m.estado && <Badge tone="violet">{m.estado}</Badge>}
                  </div>
                </div>
                {m.estado === 'PROGRAMADA' && canReport && (
                  <Button
                    variant="secondary"
                    block
                    className="mt-3"
                    onClick={() =>
                      goBackTo(`/visita/${visitId}/mantenimiento/${m.id}/completar`)
                    }
                  >
                    Completar orden
                  </Button>
                )}
              </Card>
            ))}
          </section>
        )}
      </Page>
    </div>
  )
}
