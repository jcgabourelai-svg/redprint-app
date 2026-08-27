import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import api from '@/lib/api'
import { useLinkFieldRecord } from '@/hooks/useFieldRecords'
import { parseApiError } from '@/lib/api-errors'
import { formatDate } from '@/lib/formatters'
import { VisitTypeLabels } from '@/types/enums'
import type { FieldRecord, LinkFieldRecordPayload } from '@/types/field-record'
import type { Client } from '@/types/client'
import type { Contract } from '@/types/contract'
import type { Article } from '@/types/article'
import type { PaginatedResponse } from '@/types/api'

interface LinkFieldRecordModalProps {
  record: FieldRecord | null
  isOpen: boolean
  onClose: () => void
  onSuccess: (mensaje: string) => void
  onError: (mensaje: string) => void
}

interface AlmacenPrinter {
  id: number
  marca: string
  modelo: string
  num_serie: string
  num_inventario?: string | null
  estado?: string
}

interface ArticuloRow {
  key: number
  evidencia?: string
  articulo_id: string
  cantidad: number
}

const stepLabels = ['Destino', 'Mapeo', 'Confirmación']

let rowKeySeq = 0

export default function LinkFieldRecordModal({
  record,
  isOpen,
  onClose,
  onSuccess,
  onError,
}: LinkFieldRecordModalProps) {
  const [step, setStep] = useState(1)
  const [clienteId, setClienteId] = useState('')
  const [contratoId, setContratoId] = useState('')
  const [fuenteImpresora, setFuenteImpresora] = useState<'contrato' | 'almacen'>('contrato')
  const [impresoraContratoId, setImpresoraContratoId] = useState('')
  const [impresoraAlmacenId, setImpresoraAlmacenId] = useState('')
  const [justificacion, setJustificacion] = useState('')
  const [forceJustificacion, setForceJustificacion] = useState(false)
  const [articuloRows, setArticuloRows] = useState<ArticuloRow[]>([])
  const [tipoVisita, setTipoVisita] = useState('')
  const [motivoCierre, setMotivoCierre] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const linkMutation = useLinkFieldRecord()

  const esLectura = record?.tipo === 'LECTURA'
  const esEntrega = record?.tipo === 'ENTREGA_INSUMOS'
  const esOtro = record?.tipo === 'OTRO'

  const { data: clientsPage } = useQuery<PaginatedResponse<Client>>({
    queryKey: ['clients', 'field-record-link'],
    queryFn: () =>
      api
        .get('/clients', { params: { per_page: 100, sort_by: 'razon_social', sort_dir: 'asc' } })
        .then((r) => r.data),
    enabled: isOpen,
  })

  const { data: contractsPage } = useQuery<PaginatedResponse<Contract>>({
    queryKey: ['contracts', 'field-record-link', clienteId],
    queryFn: () =>
      api
        .get('/contracts', { params: { cliente_id: clienteId, estado: 'ACTIVO', per_page: 100 } })
        .then((r) => r.data),
    enabled: isOpen && !!clienteId,
  })

  const contratoSeleccionado = useMemo(
    () => contractsPage?.data.find((c) => String(c.id) === contratoId) ?? null,
    [contractsPage, contratoId]
  )

  const { data: contratoDetalle } = useQuery<Contract>({
    queryKey: ['contracts', 'detail', contratoId],
    queryFn: () => api.get(`/contracts/${contratoId}`).then((r) => r.data),
    enabled: isOpen && esLectura && fuenteImpresora === 'contrato' && !!contratoId,
  })

  const { data: almacenPrintersPage } = useQuery<PaginatedResponse<AlmacenPrinter>>({
    queryKey: ['printers', 'en-almacen'],
    queryFn: () =>
      api
        .get('/printers', { params: { estado: 'EN_ALMACEN', per_page: 100 } })
        .then((r) => r.data),
    enabled: isOpen && esLectura && fuenteImpresora === 'almacen',
  })

  const { data: articlesPage } = useQuery<PaginatedResponse<Article>>({
    queryKey: ['articles', 'field-record-link'],
    queryFn: () =>
      api
        .get('/articles', { params: { per_page: 100, sort_by: 'nombre', sort_dir: 'asc' } })
        .then((r) => r.data),
    enabled: isOpen && esEntrega,
  })

  useEffect(() => {
    if (!isOpen || !record) return
    setStep(1)
    setClienteId('')
    setContratoId('')
    setFuenteImpresora('contrato')
    setImpresoraContratoId('')
    setImpresoraAlmacenId('')
    setJustificacion('')
    setForceJustificacion(false)
    setSubmitError(null)
    setTipoVisita('')
    setMotivoCierre('')
    const evidencia = record.articulos_entregados ?? []
    setArticuloRows(
      evidencia.length > 0
        ? evidencia.map((a) => ({
            key: ++rowKeySeq,
            evidencia: `${a.descripcion} × ${a.cantidad}`,
            articulo_id: '',
            cantidad: a.cantidad,
          }))
        : [{ key: ++rowKeySeq, articulo_id: '', cantidad: 1 }]
    )
  }, [isOpen, record])

  if (!record) return null

  const impresorasContrato = contratoDetalle?.impresoras ?? []
  const impresoraAsignada = impresorasContrato.find(
    (p) => String(p.impresora_id) === impresoraContratoId
  )
  const impresoraAlmacen = almacenPrintersPage?.data.find((p) => String(p.id) === impresoraAlmacenId)

  const impresoraId =
    esLectura
      ? fuenteImpresora === 'contrato'
        ? Number(impresoraContratoId) || undefined
        : Number(impresoraAlmacenId) || undefined
      : undefined

  // Lectura previa estimada: el server sigue siendo la fuente de verdad
  const lecturaPrevia =
    fuenteImpresora === 'contrato' && impresoraAsignada
      ? Math.max(impresoraAsignada.contador_actual, impresoraAsignada.lectura_inicial)
      : null
  const posibleAnomalia =
    esLectura &&
    record.valor_contador != null &&
    lecturaPrevia != null &&
    record.valor_contador < lecturaPrevia
  const showJustificacion = forceJustificacion || posibleAnomalia

  const clientOptions = (clientsPage?.data ?? []).map((c) => ({
    value: String(c.id),
    label: c.razon_social,
  }))
  const contractOptions = (contractsPage?.data ?? []).map((c) => ({
    value: String(c.id),
    label: `${c.codigo_negocio ?? `#${c.id}`} (${formatDate(c.fecha_inicio)})`,
  }))
  const impresorasContratoOptions = impresorasContrato.map((p) => ({
    value: String(p.impresora_id),
    label: `${p.impresora_marca} ${p.impresora_modelo} · ${p.impresora_serie}`,
  }))
  const almacenOptions = (almacenPrintersPage?.data ?? []).map((p) => ({
    value: String(p.id),
    label: `${p.marca} ${p.modelo} · ${p.num_serie}${p.num_inventario ? ` (${p.num_inventario})` : ''}`,
  }))
  const articleOptions = (articlesPage?.data ?? []).map((a) => ({
    value: String(a.id),
    label: `${a.nombre}${a.stock_actual != null ? ` · stock: ${a.stock_actual}` : ''}`,
  }))

  const articulosValidos = articuloRows.filter((r) => r.articulo_id !== '' && r.cantidad >= 1)

  const step1Valido =
    clienteId !== '' && contratoId !== '' && (!esLectura || impresoraId !== undefined)
  const step2Valido = esLectura
    ? !showJustificacion || justificacion.trim().length >= 5
    : esEntrega
      ? articulosValidos.length > 0
      : tipoVisita !== '' && motivoCierre.trim() !== ''
  const puedeConfirmar = step1Valido && step2Valido

  function handleConfirm() {
    if (!record || !puedeConfirmar) return
    setSubmitError(null)

    const data: LinkFieldRecordPayload = {
      cliente_id: Number(clienteId),
      contrato_id: Number(contratoId),
    }

    if (esLectura && impresoraId) {
      data.impresora_id = impresoraId
      if (showJustificacion && justificacion.trim() !== '') {
        data.justificacion_anomalia = justificacion.trim()
      }
    }

    if (esEntrega) {
      data.articulos = articulosValidos.map((r) => ({
        articulo_id: Number(r.articulo_id),
        cantidad: r.cantidad,
      }))
    }

    if (esOtro) {
      data.tipo_visita = tipoVisita
      data.motivo_cierre = motivoCierre.trim()
    }

    linkMutation.mutate(
      { id: record.id, data },
      {
        onSuccess: () => {
          onSuccess(`Registro #${record.id} vinculado correctamente.`)
          onClose()
        },
        onError: (err) => {
          const msg = parseApiError(err)
          if (msg.toLowerCase().includes('justificacion')) {
            setForceJustificacion(true)
            setStep(2)
          }
          setSubmitError(msg)
          onError(msg)
        },
      }
    )
  }

  const clienteNombre = clientOptions.find((c) => c.value === clienteId)?.label ?? '-'
  const contratoNombre = contractOptions.find((c) => c.value === contratoId)?.label ?? '-'
  const articulosMap = new Map(articleOptions.map((a) => [a.value, a.label]))

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Vincular registro #${record.id}`} size="lg">
      <div className="space-y-5">
        {/* Progreso */}
        <div className="flex items-center gap-2 text-xs">
          {stepLabels.map((label, i) => {
            const n = i + 1
            const done = step > n
            const active = step === n
            return (
              <div key={label} className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full font-semibold ${
                    active
                      ? 'bg-primary text-primary-foreground'
                      : done
                        ? 'bg-success text-success-foreground'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {done ? '✓' : n}
                </span>
                <span className={active ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                  {label}
                </span>
                {n < stepLabels.length && <span className="text-muted-foreground">—</span>}
              </div>
            )
          })}
        </div>

        {submitError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Elige a qué cliente y contrato reales corresponde el registro capturado en campo.
              Si el cliente o el contrato aún no existen,{' '}
              <Link to="/clientes" className="text-primary hover:underline" target="_blank">
                da de alta el cliente
              </Link>{' '}
              y{' '}
              <Link to="/contratos/crear" className="text-primary hover:underline" target="_blank">
                el contrato
              </Link>{' '}
              primero, y vuelve a esta bandeja.
            </p>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Cliente</label>
              <Select
                options={clientOptions}
                value={clienteId}
                onChange={(v) => {
                  setClienteId(v)
                  setContratoId('')
                  setImpresoraContratoId('')
                }}
                placeholder="Buscar y seleccionar cliente…"
                searchable
              />
            </div>

            {clienteId !== '' && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Contrato activo
                </label>
                {contractOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    El cliente no tiene contratos activos. Crea el contrato antes de vincular.
                  </p>
                ) : (
                  <Select
                    options={contractOptions}
                    value={contratoId}
                    onChange={(v) => {
                      setContratoId(v)
                      setImpresoraContratoId('')
                    }}
                    placeholder="Seleccionar contrato…"
                  />
                )}
              </div>
            )}

            {esLectura && contratoId !== '' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFuenteImpresora('contrato')
                      setImpresoraAlmacenId('')
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      fuenteImpresora === 'contrato'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground hover:bg-muted/70'
                    }`}
                  >
                    Impresora del contrato
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFuenteImpresora('almacen')
                      setImpresoraContratoId('')
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      fuenteImpresora === 'almacen'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground hover:bg-muted/70'
                    }`}
                  >
                    Instalar desde almacén
                  </button>
                </div>

                {fuenteImpresora === 'contrato' ? (
                  impresorasContratoOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      El contrato no tiene impresoras asignadas. Usa “Instalar desde almacén” o
                      asigna una primero en el contrato.
                    </p>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Impresora activa del contrato
                      </label>
                      <Select
                        options={impresorasContratoOptions}
                        value={impresoraContratoId}
                        onChange={setImpresoraContratoId}
                        placeholder="Seleccionar impresora…"
                      />
                    </div>
                  )
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Impresora en almacén (se instalará en el contrato)
                    </label>
                    <Select
                      options={almacenOptions}
                      value={impresoraAlmacenId}
                      onChange={setImpresoraAlmacenId}
                      placeholder="Seleccionar impresora de almacén…"
                      searchable
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {esLectura && (
              <>
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Contador capturado en campo</p>
                    <p className="font-semibold tabular-nums">
                      {Number(record.valor_contador ?? 0).toLocaleString('es-MX')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {fuenteImpresora === 'almacen'
                        ? 'Instalación desde almacén'
                        : 'Lectura previa (estimado)'}
                    </p>
                    <p className="font-semibold tabular-nums">
                      {fuenteImpresora === 'almacen'
                        ? 'Línea base = contador capturado (0 páginas)'
                        : lecturaPrevia != null
                          ? lecturaPrevia.toLocaleString('es-MX')
                          : '-'}
                    </p>
                  </div>
                </div>

                {fuenteImpresora === 'almacen' && (
                  <p className="text-sm text-muted-foreground">
                    La impresora se instalará en el contrato con{' '}
                    <strong>lectura inicial = contador capturado</strong>: no se cobra histórico
                    previo y la lectura resultará en 0 páginas del periodo.
                  </p>
                )}

                {posibleAnomalia && (
                  <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      El contador capturado es menor a la lectura previa estimada
                      ({lecturaPrevia?.toLocaleString('es-MX')}). El servidor exigirá una
                      justificación para registrar la anomalía.
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Justificación de anomalía {showJustificacion ? '*' : '(opcional)'}
                  </label>
                  <textarea
                    rows={3}
                    value={justificacion}
                    onChange={(e) => setJustificacion(e.target.value)}
                    placeholder="Describe el motivo (cambio de tambor, reinicio de contador, error de lectura…)"
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </>
            )}

            {esEntrega && (
              <>
                <p className="text-sm text-muted-foreground">
                  Mapea los insumos que el operador reportó a artículos del catálogo. La salida de
                  stock se registra al confirmar. Si un artículo no existe,{' '}
                  <Link to="/inventario/articulos" className="text-primary hover:underline" target="_blank">
                    créalo primero
                  </Link>
                  .
                </p>

                <div className="space-y-3">
                  {articuloRows.map((row, idx) => (
                    <div
                      key={row.key}
                      className="rounded-lg border border-border p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Entrega {idx + 1}
                          {row.evidencia && (
                            <span className="ml-1 font-normal">· Reportado: {row.evidencia}</span>
                          )}
                        </span>
                        {articuloRows.length > 1 && (
                          <button
                            type="button"
                            className="text-xs text-destructive hover:underline"
                            onClick={() =>
                              setArticuloRows((rows) => rows.filter((r) => r.key !== row.key))
                            }
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Select
                            options={articleOptions}
                            value={row.articulo_id}
                            onChange={(v) =>
                              setArticuloRows((rows) =>
                                rows.map((r) => (r.key === row.key ? { ...r, articulo_id: v } : r))
                              )
                            }
                            placeholder="Seleccionar artículo…"
                            searchable
                          />
                        </div>
                        <input
                          type="number"
                          min={1}
                          value={row.cantidad}
                          onChange={(e) =>
                            setArticuloRows((rows) =>
                              rows.map((r) =>
                                r.key === row.key
                                  ? { ...r, cantidad: Math.max(1, Number(e.target.value) || 1) }
                                  : r
                              )
                            )
                          }
                          className="w-24 rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setArticuloRows((rows) => [
                      ...rows,
                      { key: ++rowKeySeq, articulo_id: '', cantidad: 1 },
                    ])
                  }
                >
                  + Agregar artículo
                </Button>
              </>
            )}

            {esOtro && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Tipo de visita a crear *
                  </label>
                  <Select
                    options={Object.entries(VisitTypeLabels).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                    value={tipoVisita}
                    onChange={setTipoVisita}
                    placeholder="Seleccionar tipo de visita…"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Motivo de cierre *
                  </label>
                  <textarea
                    rows={3}
                    value={motivoCierre}
                    onChange={(e) => setMotivoCierre(e.target.value)}
                    placeholder="La visita se creará ya completada con este motivo (no hay actividades que registrar)."
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p>
                  Se creará una <strong>visita de campo</strong> del{' '}
                  {formatDate(record.capturado_en)} para <strong>{clienteNombre}</strong>{' '}
                  (contrato {contratoNombre}), asignada al socio que capturó el registro
                  ({record.socio_nombre ?? `#${record.socio_id}`}).
                </p>

                {esLectura && (
                  <p className="mt-2">
                    {fuenteImpresora === 'almacen' ? (
                      <>
                        Se instalará la impresora <strong>{impresoraAlmacen?.num_serie}</strong>{' '}
                        desde almacén (lectura inicial ={' '}
                        {Number(record.valor_contador ?? 0).toLocaleString('es-MX')}) y se
                        registrará la lectura con <strong>0 páginas del periodo</strong>.
                      </>
                    ) : (
                      <>
                        Se registrará la lectura del contador{' '}
                        <strong>
                          {Number(record.valor_contador ?? 0).toLocaleString('es-MX')}
                        </strong>{' '}
                        (
                        {lecturaPrevia != null
                          ? `${Math.max(0, Number(record.valor_contador ?? 0) - lecturaPrevia).toLocaleString('es-MX')} páginas del periodo estimadas`
                          : 'páginas calculadas por el servidor'}
                        ).
                      </>
                    )}
                  </p>
                )}

                {esEntrega && articulosValidos.length > 0 && (
                  <div className="mt-2">
                    <p>Saldrán del stock:</p>
                    <ul className="mt-1 list-disc pl-5">
                      {articulosValidos.map((r) => (
                        <li key={r.key}>
                          {articulosMap.get(r.articulo_id) ?? `#${r.articulo_id}`} ×{' '}
                          <strong>{r.cantidad}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {esOtro && (
                  <p className="mt-2">
                    La visita será de tipo{' '}
                    <strong>{VisitTypeLabels[tipoVisita as keyof typeof VisitTypeLabels]}</strong> y
                    quedará completada con motivo:{' '}
                    <em>“{motivoCierre.trim()}”</em>.
                  </p>
                )}

                <p className="mt-2 text-muted-foreground">
                  Esta acción no se puede deshacer: el registro quedará{' '}
                  <strong>vinculado e inmutable</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between pt-2">
          <div>
            {step > 1 && (
              <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Atrás
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose} disabled={linkMutation.isPending}>
              Cancelar
            </Button>
            {step < 3 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={(step === 1 && !step1Valido) || (step === 2 && !step2Valido)}
              >
                Continuar <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleConfirm} loading={linkMutation.isPending} disabled={!puedeConfirmar}>
                Vincular registro
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
