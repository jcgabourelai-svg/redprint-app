import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useGoBack } from '../hooks/useGoBack'
import { useOnline } from '../hooks/useOnline'
import { useToast } from '../components/Toast'
import api, { apiErrorMessage, fetchAll } from '../lib/api'
import { formatNumber } from '../lib/format'
import type { Visit, Warehouse } from '../types/api'
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Page,
  PageHeader,
  SectionTitle,
  SkeletonCard,
} from '../components/ui'

export default function RemovalPage() {
  const { id } = useParams()
  const visitId = Number(id)
  const goBackTo = useGoBack()
  const [searchParams] = useSearchParams()
  const { hasPermission } = useAuth()
  const toast = useToast()
  const online = useOnline()

  const canRemove = hasPermission('contratos') && hasPermission('inventario.almacenes')

  const [visit, setVisit] = useState<Visit | null>(null)
  const [loadingVisit, setLoadingVisit] = useState(true)
  const [visitError, setVisitError] = useState<string | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[] | null>(null)
  const [warehousesError, setWarehousesError] = useState<string | null>(null)
  const [printerId, setPrinterId] = useState<string | null>(searchParams.get('impresora'))
  const [warehouseId, setWarehouseId] = useState<number | null>(null)
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

  const contratoId = visit?.contrato_id ?? null
  const printers = visit?.impresoras ?? []
  const selectedPrinter = printers.find((p) => p.impresora_id === printerId) ?? null

  useEffect(() => {
    if (!canRemove || !contratoId) return
    let cancelled = false
    fetchAll<Warehouse>('/warehouses')
      .then((ws) => {
        if (!cancelled) {
          setWarehouses(ws.filter((w) => w.activo))
          setWarehousesError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) setWarehousesError(apiErrorMessage(e))
      })
    return () => {
      cancelled = true
    }
  }, [canRemove, contratoId])

  async function handleSubmit() {
    if (!contratoId || selectedPrinter === null || warehouseId === null) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await api.post(`/contracts/${contratoId}/release-printer`, {
        impresora_id: Number(selectedPrinter.impresora_id),
        almacen_destino_id: warehouseId,
        visita_id: visitId,
      })
      toast.success('Impresora liberada al almacén')
      goBackTo(`/visita/${visitId}`, 2)
    } catch (e) {
      setSubmitError(apiErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const title = visit ? (visit.cliente_nombre ?? 'Retiro') : 'Retiro'
  const showForm = canRemove && contratoId !== null
  const printerParam = searchParams.get('impresora')
  const goBack = () =>
    goBackTo(
      printerParam ? `/visita/${visitId}/impresora/${printerParam}` : `/visita/${visitId}`
    )

  return (
    <div>
      <PageHeader title={title} onBack={goBack} />
      <Page>
        {!canRemove && (
          <Banner tone="error">
            No tienes permiso para retirar impresoras (se requieren permisos de contratos y
            almacenes).
          </Banner>
        )}
        {!online && canRemove && (
          <div className="mb-4">
            <Banner tone="warn">📴 Sin conexión. El retiro requiere conexión a internet.</Banner>
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
              Esta visita no tiene contrato asociado. No se puede retirar una impresora.
            </Banner>
          </div>
        )}

        {showForm && (
          <>
            {printerParam ? (
              <>
                <SectionTitle hint="Impresora seleccionada previamente">
                  Impresora a retirar
                </SectionTitle>
                {selectedPrinter ? (
                  <Card className="mb-3 !border-orange-300 bg-orange-50/50">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-800">
                        {selectedPrinter.alias ?? `${selectedPrinter.marca} ${selectedPrinter.modelo}`}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {selectedPrinter.alias && `${selectedPrinter.marca} ${selectedPrinter.modelo} · `}
                        Serie: {selectedPrinter.numero_serie ?? '-'}
                      </p>
                      <p className="text-xs text-gray-400">
                        Última lectura: {formatNumber(selectedPrinter.lectura_anterior)}
                      </p>
                    </div>
                  </Card>
                ) : (
                  !loadingVisit && (
                    <div className="mb-4">
                      <Banner tone="warn">
                        La impresora seleccionada ya no está activa en el contrato de esta visita.
                      </Banner>
                    </div>
                  )
                )}
              </>
            ) : (
              <>
                <SectionTitle hint="Selecciona la impresora a retirar">
                  Impresoras del contrato
                </SectionTitle>
                {printers.length === 0 && (
                  <EmptyState icon="🖨️" text="El contrato no tiene impresoras activas para retirar" />
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
                          {p.alias ?? `${p.marca} ${p.modelo}`}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {p.alias && `${p.marca} ${p.modelo} · `}
                          Serie: {p.numero_serie ?? '-'}
                        </p>
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

            {printerId !== null && warehouses !== null && (
              <div className="mt-5">
                <SectionTitle>Almacén destino</SectionTitle>
                {warehouses.map((w) => (
                  <Card
                    key={w.id}
                    className={`mb-3 ${warehouseId === w.id ? '!border-blue-500 ring-1 ring-blue-500' : ''}`}
                    onClick={() => setWarehouseId(w.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-800">{w.nombre}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{w.direccion}</p>
                      </div>
                      {warehouseId === w.id && <span className="text-blue-600">✓</span>}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {warehousesError && (
              <div className="mb-4">
                <Banner tone="error">{warehousesError}</Banner>
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
              disabled={selectedPrinter === null || warehouseId === null || !online || submitting}
              loading={submitting}
              onClick={() => void handleSubmit()}
            >
              Confirmar retiro
            </Button>
          </>
        )}
      </Page>
    </div>
  )
}
