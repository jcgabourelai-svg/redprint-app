import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useGoBack } from '../hooks/useGoBack'
import { useOnline } from '../hooks/useOnline'
import { useToast } from '../components/Toast'
import api, { apiErrorMessage, fetchAll } from '../lib/api'
import type { Printer, Visit } from '../types/api'
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Page,
  PageHeader,
  SectionTitle,
  SkeletonCard,
  TextInput,
} from '../components/ui'

export default function InstallationPage() {
  const { id } = useParams()
  const visitId = Number(id)
  const goBackTo = useGoBack()
  const { hasPermission } = useAuth()
  const toast = useToast()
  const online = useOnline()

  const canInstall =
    hasPermission('contratos') && hasPermission('inventario.impresoras')

  const [visit, setVisit] = useState<Visit | null>(null)
  const [loadingVisit, setLoadingVisit] = useState(true)
  const [visitError, setVisitError] = useState<string | null>(null)
  const [printers, setPrinters] = useState<Printer[] | null>(null)
  const [printersError, setPrintersError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [lecturaInicial, setLecturaInicial] = useState('0')
  const [alias, setAlias] = useState('')
  const [aliasSugerido, setAliasSugerido] = useState<string | null>(null)
  const [colorHeredado, setColorHeredado] = useState<string | null>(null)
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
          // Rotacion de flota: la impresora retirada en esta visita libera su
          // "puesto"; se sugiere su alias para la impresora que la reemplaza
          // y se reenvia su color (herencia best-effort, invisible al usuario).
          const cambios = res.data.cambios_impresoras
          const liberacion = cambios?.find(
            (c) => c.evento === 'LIBERACION_CONTRATO' && c.alias
          )
          if (liberacion?.alias) {
            setAliasSugerido(liberacion.alias)
            setAlias((actual) => actual || liberacion.alias || '')
          }
          // El color del puesto se hereda con independencia del alias: el
          // backend congela ambos por separado en el evento de liberacion.
          setColorHeredado(
            cambios?.find((c) => c.evento === 'LIBERACION_CONTRATO' && c.color)?.color ?? null
          )
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

  const contratoId = visit?.contrato_id ?? null

  useEffect(() => {
    if (!canInstall || !contratoId) return
    let cancelled = false
    fetchAll<Printer>('/printers', { estado: 'EN_ALMACEN' })
      .then((ps) => {
        if (!cancelled) {
          setPrinters(ps)
          setPrintersError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) setPrintersError(apiErrorMessage(e))
      })
    return () => {
      cancelled = true
    }
  }, [canInstall, contratoId])

  async function handleSubmit() {
    if (!contratoId || selectedId === null) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await api.post(`/contracts/${contratoId}/assign-printer`, {
        impresora_id: selectedId,
        lectura_inicial: Number.parseInt(lecturaInicial || '0', 10) || 0,
        visita_id: visitId,
        alias: alias.trim() || null,
        color: colorHeredado,
      })
      toast.success('Impresora asignada al contrato')
      goBackTo(`/visita/${visitId}`)
    } catch (e) {
      setSubmitError(apiErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const title = visit ? (visit.cliente_nombre ?? 'Instalación') : 'Instalación'

  return (
    <div>
      <PageHeader title={title} onBack={() => goBackTo(`/visita/${visitId}`)} />
      <Page>
        {!canInstall && (
          <Banner tone="error">
            No tienes permiso para instalar impresoras (se requieren permisos de contratos e
            inventario).
          </Banner>
        )}
        {!online && canInstall && (
          <div className="mb-4">
            <Banner tone="warn">
              📴 Sin conexión. La instalación requiere conexión a internet.
            </Banner>
          </div>
        )}

        {loadingVisit && <SkeletonCard />}

        {visitError && (
          <div className="mb-4">
            <Banner tone="error">{visitError}</Banner>
          </div>
        )}

        {visit && !contratoId && (
          <div className="mb-4">
            <Banner tone="warn">
              Esta visita no tiene contrato asociado. No se puede instalar una impresora.
            </Banner>
          </div>
        )}

        {canInstall && contratoId && (
          <>
            <SectionTitle hint="Selecciona una impresora disponible en almacén">
              Impresoras en almacén
            </SectionTitle>

            {printersError && (
              <div className="mb-4">
                <Banner tone="error">{printersError}</Banner>
              </div>
            )}

            {printers === null && !printersError && (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            )}

            {printers !== null && printers.length === 0 && (
              <EmptyState icon="🖨️" text="No hay impresoras disponibles para instalación" />
            )}

            {printers?.map((p) => (
              <Card
                key={p.id}
                className={`mb-3 ${selectedId === p.id ? '!border-blue-500 ring-1 ring-blue-500' : ''}`}
                onClick={() => setSelectedId(p.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-800">
                      {p.marca} {p.modelo}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">Serie: {p.num_serie ?? '-'}</p>
                    <p className="text-xs text-gray-500">
                      Inventario: {p.num_inventario ?? '-'}
                      {p.warehouse ? ` · ${p.warehouse.nombre}` : ''}
                    </p>
                    <p className="text-xs text-gray-400">Contador: {p.contador_actual}</p>
                  </div>
                  {selectedId === p.id && <span className="text-blue-600">✓</span>}
                </div>
              </Card>
            ))}

            {selectedId !== null && (
              <div className="mt-5 space-y-4">
                <Field label="Lectura inicial" help="Valor del contador al momento de la instalación">
                  <TextInput
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={lecturaInicial}
                    onChange={(e) => setLecturaInicial(e.target.value)}
                  />
                </Field>
                <Field
                  label="Alias / ubicación (opcional)"
                  help={
                    aliasSugerido && alias === aliasSugerido
                      ? `Heredado de la impresora retirada en esta visita (${aliasSugerido}); edítalo si cambia el puesto`
                      : 'Cómo la identifica el cliente en el sitio. Ej. Recepción'
                  }
                >
                  <TextInput
                    type="text"
                    value={alias}
                    maxLength={60}
                    placeholder="Ej. Recepción"
                    onChange={(e) => setAlias(e.target.value)}
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
              disabled={selectedId === null || !online || submitting}
              loading={submitting}
              onClick={() => void handleSubmit()}
            >
              Confirmar instalación
            </Button>
          </>
        )}
      </Page>
    </div>
  )
}
