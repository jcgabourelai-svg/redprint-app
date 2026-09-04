import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useGoBack } from '../hooks/useGoBack'
import { useOnline } from '../hooks/useOnline'
import { useToast } from '../components/Toast'
import api, { apiErrorMessage, fetchAll } from '../lib/api'
import { formatNumber } from '../lib/format'
import { MOTIVO_LIBERACION_LABEL } from '../lib/motivosLiberacion'
import PrinterColorDot from '../components/PrinterColorDot'
import type { MotivoLiberacion, Visit, Warehouse } from '../types/api'
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
  TextArea,
  TextInput,
} from '../components/ui'

const MOTIVOS: { value: MotivoLiberacion; label: string }[] = (
  Object.keys(MOTIVO_LIBERACION_LABEL) as MotivoLiberacion[]
).map((value) => ({ value, label: MOTIVO_LIBERACION_LABEL[value] }))

export default function RemovalPage() {
  const { id } = useParams()
  const visitId = Number(id)
  const goBackTo = useGoBack()
  const [searchParams] = useSearchParams()
  const { hasPermission } = useAuth()
  const toast = useToast()
  const online = useOnline()

  const canRemove = hasPermission('contratos') && hasPermission('inventario.almacenes')
  const canMaintain = hasPermission('inventario.mantenimiento')

  const [visit, setVisit] = useState<Visit | null>(null)
  const [loadingVisit, setLoadingVisit] = useState(true)
  const [visitError, setVisitError] = useState<string | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[] | null>(null)
  const [warehousesError, setWarehousesError] = useState<string | null>(null)
  const [printerId, setPrinterId] = useState<string | null>(searchParams.get('impresora'))
  const [warehouseId, setWarehouseId] = useState<number | null>(null)
  const [motivo, setMotivo] = useState<MotivoLiberacion>('SUSTITUCION_FALLA')
  const [lecturaFinal, setLecturaFinal] = useState('')
  const [sinLectura, setSinLectura] = useState(false)
  const [justificacion, setJustificacion] = useState('')
  const [crearOrden, setCrearOrden] = useState(true)
  const [descOrden, setDescOrden] = useState('')
  const [descOrdenTouched, setDescOrdenTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const enviarCrearOrden = crearOrden && canMaintain && motivo === 'SUSTITUCION_FALLA'
  const descOrdenValida = descOrden.trim().length >= 5

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

  const lecturaNum = lecturaFinal.trim() === '' ? null : Number.parseInt(lecturaFinal, 10)
  const deltaPreview = useMemo(() => {
    if (lecturaNum === null || !selectedPrinter || !Number.isFinite(lecturaNum)) return null
    return lecturaNum - selectedPrinter.lectura_anterior
  }, [lecturaNum, selectedPrinter])

  const justificacionValida = justificacion.trim().length >= 5
  const canSubmit =
    !!selectedPrinter &&
    warehouseId !== null &&
    (sinLectura
      ? justificacionValida
      : lecturaNum !== null && Number.isFinite(lecturaNum) && lecturaNum >= 0) &&
    (!enviarCrearOrden || descOrdenValida) &&
    !submitting

  async function handleSubmit() {
    if (!contratoId || selectedPrinter === null || warehouseId === null) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await api.post(`/contracts/${contratoId}/release-printer`, {
        impresora_id: Number(selectedPrinter.impresora_id),
        almacen_destino_id: warehouseId,
        visita_id: visitId,
        lectura_final: sinLectura ? null : lecturaNum,
        motivo_liberacion: motivo,
        justificacion_sin_lectura: sinLectura ? justificacion.trim() : null,
        crear_orden_mantenimiento: enviarCrearOrden || undefined,
        desc_problema: enviarCrearOrden ? descOrden.trim() : undefined,
      })
      toast.success(
        enviarCrearOrden
          ? 'Impresora retirada y orden de mantenimiento creada'
          : sinLectura
            ? 'Impresora liberada sin lectura (brecha registrada)'
            : 'Impresora liberada con lectura de cierre'
      )
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
                      <p className="flex items-center gap-1.5 truncate font-semibold text-gray-800">
                        {selectedPrinter.color && <PrinterColorDot color={selectedPrinter.color} />}
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
                        <p className="flex items-center gap-1.5 truncate font-semibold text-gray-800">
                          {p.color && <PrinterColorDot color={p.color} />}
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

            {printerId !== null && selectedPrinter && (
              <div className="mt-5 space-y-4">
                <Field label="Motivo del retiro">
                  <div className="grid grid-cols-1 gap-2">
                    {MOTIVOS.map((m) => (
                      <Card
                        key={m.value}
                        className={`py-2.5 ${motivo === m.value ? '!border-blue-500 ring-1 ring-blue-500' : ''}`}
                        onClick={() => setMotivo(m.value)}
                      >
                        <div className="flex items-center justify-between px-1">
                          <span className="text-sm font-medium text-gray-800">{m.label}</span>
                          {motivo === m.value && <span className="text-blue-600">✓</span>}
                        </div>
                      </Card>
                    ))}
                  </div>
                </Field>

                <Field
                  label="Contador al retirar"
                  help={`Última lectura registrada: ${formatNumber(selectedPrinter.lectura_anterior)}. El tramo hasta este valor se facturará.`}
                >
                  <TextInput
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="Valor del contador al retirar"
                    value={sinLectura ? '' : lecturaFinal}
                    disabled={sinLectura}
                    onChange={(e) => setLecturaFinal(e.target.value)}
                  />
                </Field>

                {deltaPreview !== null && !sinLectura && (
                  <Card
                    className={`${
                      deltaPreview < 0
                        ? '!border-red-300 bg-red-50'
                        : 'bg-blue-50'
                    }`}
                  >
                    <p
                      className={`text-sm font-semibold ${
                        deltaPreview < 0 ? 'text-red-700' : 'text-blue-800'
                      }`}
                    >
                      Páginas desde la última lectura: {formatNumber(deltaPreview)}
                    </p>
                    <p className={`mt-0.5 text-xs ${deltaPreview < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                      {deltaPreview < 0
                        ? 'El contador no puede ser menor a la última lectura: revisa la captura.'
                        : 'Este tramo quedará facturado con la lectura de cierre'}
                    </p>
                  </Card>
                )}

                <label className="flex items-start gap-2.5 rounded-xl border border-gray-200 p-3">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={sinLectura}
                    onChange={(e) => setSinLectura(e.target.checked)}
                  />
                  <span className="text-sm text-gray-700">
                    <span className="font-semibold">No se puede leer el contador</span>
                    <span className="block text-xs text-gray-500">
                      Equipo muerto o inaccesible: se registrará la brecha y el tramo sin leer no
                      se facturará.
                    </span>
                  </span>
                </label>

                {sinLectura && (
                  <Field
                    label="Justificación *"
                    help="Explica por qué no fue posible leer el contador"
                    error={
                      justificacion.trim().length > 0 && !justificacionValida
                        ? 'La justificación debe tener al menos 5 caracteres'
                        : null
                    }
                  >
                    <TextArea
                      rows={3}
                      placeholder="Ej. Equipo no enciende, panel sin respuesta"
                      value={justificacion}
                      onChange={(e) => {
                        setJustificacion(e.target.value)
                        if (!descOrdenTouched) setDescOrden(e.target.value)
                      }}
                    />
                  </Field>
                )}

                {motivo === 'SUSTITUCION_FALLA' && !canMaintain && (
                  <Banner tone="info">
                    No tienes permiso de mantenimiento: la impresora se retirará sin orden de
                    mantenimiento.
                  </Banner>
                )}

                {motivo === 'SUSTITUCION_FALLA' && canMaintain && (
                  <div className="space-y-3 rounded-xl border border-gray-200 p-3">
                    <label className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={crearOrden}
                        onChange={(e) => setCrearOrden(e.target.checked)}
                      />
                      <span className="text-sm text-gray-700">
                        <span className="font-semibold">Crear orden correctiva</span>
                        <span className="block text-xs text-gray-500">
                          La impresora quedará EN_MANTENIMIENTO (taller) hasta completar la orden.
                          Se crea en el mismo retiro, de forma transaccional.
                        </span>
                      </span>
                    </label>

                    {crearOrden && (
                      <Field
                        label="Descripción del problema *"
                        help="Se precarga con la justificación sin lectura; edítala si hace falta."
                        error={
                          descOrden.trim().length > 0 && !descOrdenValida
                            ? 'La descripción debe tener al menos 5 caracteres'
                            : null
                        }
                      >
                        <TextArea
                          rows={3}
                          placeholder="Ej. No enciende, olor a quemado en la fuente"
                          value={descOrden}
                          onChange={(e) => {
                            setDescOrdenTouched(true)
                            setDescOrden(e.target.value)
                          }}
                        />
                      </Field>
                    )}
                  </div>
                )}
              </div>
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
              disabled={!canSubmit || !online}
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
