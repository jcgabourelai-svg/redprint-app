import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
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
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const toast = useToast()
  const online = useOnline()

  const canRemove = hasPermission('contratos') && hasPermission('inventario.almacenes')

  const [visit, setVisit] = useState<Visit | null>(null)
  const [loadingVisit, setLoadingVisit] = useState(true)
  const [visitError, setVisitError] = useState<string | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[] | null>(null)
  const [warehousesError, setWarehousesError] = useState<string | null>(null)
  const [printerId, setPrinterId] = useState<string | null>(null)
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
    if (!contratoId || printerId === null || warehouseId === null) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await api.post(`/contracts/${contratoId}/release-printer`, {
        impresora_id: Number(printerId),
        almacen_destino_id: warehouseId,
      })
      toast.success('Impresora liberada al almacén')
      navigate(`/visita/${visitId}`)
    } catch (e) {
      setSubmitError(apiErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const title = visit ? (visit.cliente_nombre ?? 'Retiro') : 'Retiro'
  const printers = visit?.impresoras ?? []
  const showForm = canRemove && contratoId !== null

  return (
    <div>
      <PageHeader title={title} onBack={() => navigate(`/visita/${visitId}`)} />
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
            <SectionTitle hint="Selecciona la impresora a retirar">Impresoras del contrato</SectionTitle>
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
              disabled={printerId === null || warehouseId === null || !online || submitting}
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
