import { useState } from 'react'
import {
  FileText,
  Upload,
  Eye,
  FilePlus2,
  Link2,
  Unlink2,
  UserPlus,
  Trash2,
  FileCheck2,
  AlertCircle,
} from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Table from '@/components/ui/Table'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Toast from '@/components/ui/Toast'
import { Card, CardContent } from '@/components/ui/Card'
import { formatCurrency, formatDateTime } from '@/lib/formatters'
import api from '@/lib/api'
import { useServerTable } from '@/hooks/useServerTable'
import {
  useGenerateInvoiceFromCfdi,
  useUnlinkCfdi,
  useDeleteCfdi,
} from '@/hooks/useCfdi'
import { parseApiError } from '@/lib/api-errors'
import ImportCfdiModal from '@/components/cfdi/ImportCfdiModal'
import CfdiDetailModal from '@/components/cfdi/CfdiDetailModal'
import LinkInvoiceModal from '@/components/cfdi/LinkInvoiceModal'
import AssignClientModal from '@/components/cfdi/AssignClientModal'
import { EstadoConciliacionBadge, EstadoClienteBadge } from '@/components/cfdi/EstadoBadges'
import {
  TipoComprobanteLabels,
  EstadoConciliacionLabels,
  EstadoClienteLabels,
} from '@/types/enums'
import type { XmlComprobante } from '@/types/cfdi'
import type { Column } from '@/components/ui/Table'

// Opciones de filtro derivadas de las unicas fuentes de verdad (los mapas de
// etiquetas), para que filtro y badge nunca diverjan.
const tipoOptions = [
  { value: '', label: 'Todos los tipos' },
  ...Object.entries(TipoComprobanteLabels).map(([value, label]) => ({ value, label })),
]
const estadoConciliacionOptions = [
  { value: '', label: 'Toda la conciliacion' },
  ...Object.entries(EstadoConciliacionLabels).map(([value, label]) => ({ value, label })),
]
const estadoClienteOptions = [
  { value: '', label: 'Todo el cliente' },
  ...Object.entries(EstadoClienteLabels).map(([value, label]) => ({ value, label })),
]

function tipoBadge(tipo: string) {
  if (tipo === 'I') return <Badge variant="success">{TipoComprobanteLabels.I}</Badge>
  if (tipo === 'E') return <Badge variant="error">{TipoComprobanteLabels.E}</Badge>
  return <Badge variant="neutral">{TipoComprobanteLabels[tipo as keyof typeof TipoComprobanteLabels] ?? tipo}</Badge>
}

export default function CfdiListPage() {
  const { data: comprobantes, tableProps, isLoading, error, hasActiveFilters } = useServerTable<XmlComprobante>({
    queryKey: ['cfdi'],
    fetcher: (p) => api.get('/cfdi', { params: p }).then((r) => r.data),
    defaultSort: { column: 'fecha_emision', dir: 'desc' },
  })

  const [toast, setToast] = useState<{ open: boolean; variant: 'success' | 'error'; message: string }>({
    open: false,
    variant: 'success',
    message: '',
  })
  const notify = (variant: 'success' | 'error', message: string) =>
    setToast({ open: true, variant, message })

  const [importOpen, setImportOpen] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [linkId, setLinkId] = useState<number | null>(null)
  const [assignTarget, setAssignTarget] = useState<{ id: number; clienteId?: number | null } | null>(null)
  const [generateTarget, setGenerateTarget] = useState<XmlComprobante | null>(null)

  const unlink = useUnlinkCfdi()
  const remove = useDeleteCfdi()

  const handleUnlink = async (c: XmlComprobante) => {
    if (!window.confirm('Desvincular este comprobante de su factura?')) return
    try {
      await unlink.mutateAsync(c.id)
      notify('success', 'Comprobante desvinculado.')
    } catch (err) {
      notify('error', parseApiError(err))
    }
  }

  const handleDelete = async (c: XmlComprobante) => {
    if (!window.confirm('Eliminar este comprobante? Esta accion no se puede deshacer.')) return
    try {
      await remove.mutateAsync(c.id)
      notify('success', 'Comprobante eliminado.')
    } catch (err) {
      notify('error', parseApiError(err))
    }
  }

  const totalConciliados = comprobantes.filter((c) => c.estado_conciliacion === 'conciliado').length
  const totalSinFactura = comprobantes.filter((c) => c.estado_conciliacion === 'sin_factura').length
  const totalSinCliente = comprobantes.filter((c) => c.estado_cliente === 'sin_cliente').length

  const columns: Column<XmlComprobante>[] = [
    {
      key: 'fecha_emision',
      label: 'Fecha',
      sortable: true,
      render: (_v, row) => <span className="text-xs">{formatDateTime(row.fecha_emision)}</span>,
    },
    {
      key: 'uuid',
      label: 'UUID',
      render: (_v, row) => (
        <span className="font-mono text-xs" title={row.uuid}>
          {row.uuid.slice(0, 8)}...
        </span>
      ),
    },
    {
      key: 'serie_folio',
      label: 'Serie-Folio',
      sortable: true,
      render: (_v, row) => row.serie_folio || <span className="text-muted-foreground">-</span>,
    },
    {
      key: 'tipo_comprobante',
      label: 'Tipo',
      sortable: true,
      render: (_v, row) => tipoBadge(row.tipo_comprobante),
    },
    {
      key: 'rfc_receptor',
      label: 'Receptor',
      sortable: true,
      render: (_v, row) => (
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{row.rfc_receptor}</p>
          <p className="text-xs text-muted-foreground truncate">{row.nombre_receptor ?? '-'}</p>
        </div>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      sortable: true,
      render: (_v, row) => <span className="font-medium">{formatCurrency(row.total)}</span>,
    },
    {
      key: 'estado_cliente',
      label: 'Cliente',
      render: (_v, row) => <EstadoClienteBadge estado={row.estado_cliente} />,
    },
    {
      key: 'estado_conciliacion',
      label: 'Estado',
      render: (_v, row) => <EstadoConciliacionBadge estado={row.estado_conciliacion} />,
    },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (_v, row) => (
        <div className="flex items-center gap-1">
          <button className="p-1 hover:bg-muted rounded" title="Ver detalle" onClick={() => setDetailId(row.id)}>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </button>
          {row.tipo_comprobante === 'I' &&
            row.estado_cliente === 'asignado' &&
            row.estado_conciliacion === 'sin_factura' && (
              <button
                className="p-1 hover:bg-muted rounded"
                title="Generar factura"
                onClick={() => setGenerateTarget(row)}
              >
                <FilePlus2 className="h-4 w-4 text-success" />
              </button>
            )}
          {row.estado_conciliacion === 'sin_factura' && row.tipo_comprobante === 'I' && (
            <button
              className="p-1 hover:bg-muted rounded"
              title="Vincular a factura"
              onClick={() => setLinkId(row.id)}
            >
              <Link2 className="h-4 w-4 text-primary" />
            </button>
          )}
          {row.estado_conciliacion === 'conciliado' && (
            <button
              className="p-1 hover:bg-muted rounded"
              title="Desvincular"
              onClick={() => handleUnlink(row)}
            >
              <Unlink2 className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          <button
            className="p-1 hover:bg-muted rounded"
            title="Asignar cliente"
            onClick={() => setAssignTarget({ id: row.id, clienteId: row.receptor_id })}
          >
            <UserPlus className="h-4 w-4 text-info" />
          </button>
          {row.estado_conciliacion === 'sin_factura' && (
            <button
              className="p-1 hover:bg-muted rounded"
              title="Eliminar"
              onClick={() => handleDelete(row)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <PageLayout title="Finanzas" showSearch>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Comprobantes CFDI</h2>
            <p className="text-sm text-muted-foreground">
              Importa facturas XML del SAT y concilialas con el sistema
            </p>
          </div>
          <Button onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar XML
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Cargando comprobantes...</p>
          </div>
        ) : error ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-destructive">Error al cargar comprobantes: {String(error)}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total importados</p>
                      <p className="text-lg font-bold">{tableProps.totalItems ?? comprobantes.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-success/10 p-2">
                      <FileCheck2 className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Conciliados</p>
                      <p className="text-lg font-bold text-success">{totalConciliados}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-warning/10 p-2">
                      <AlertCircle className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Sin factura</p>
                      <p className="text-lg font-bold">{totalSinFactura}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-destructive/10 p-2">
                      <UserPlus className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Sin cliente</p>
                      <p className="text-lg font-bold text-destructive">{totalSinCliente}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="w-40">
                <Select
                  options={tipoOptions}
                  value={tableProps.filterState.tipo_comprobante || ''}
                  onChange={(v) =>
                    tableProps.onFilterChange({ ...tableProps.filterState, tipo_comprobante: v })
                  }
                  placeholder="Tipo"
                />
              </div>
              <div className="w-44">
                <Select
                  options={estadoConciliacionOptions}
                  value={tableProps.filterState.estado_conciliacion || ''}
                  onChange={(v) =>
                    tableProps.onFilterChange({ ...tableProps.filterState, estado_conciliacion: v })
                  }
                  placeholder='Conciliacion'
                />
              </div>
              <div className="w-44">
                <Select
                  options={estadoClienteOptions}
                  value={tableProps.filterState.estado_cliente || ''}
                  onChange={(v) =>
                    tableProps.onFilterChange({ ...tableProps.filterState, estado_cliente: v })
                  }
                  placeholder='Cliente'
                />
              </div>
            </div>

            {comprobantes.length === 0 && !hasActiveFilters ? (
              <EmptyState
                icon={FileText}
                title="No hay comprobantes"
                description="Importa archivos XML (CFDI) del SAT para iniciar la conciliacion."
                action={{ label: 'Importar XML', onClick: () => setImportOpen(true) }}
              />
            ) : (
              <Table
                data={comprobantes}
                columns={columns}
                searchable
                sortable
                paginatable
                {...tableProps}
                emptyMessage="No se encontraron comprobantes con los filtros aplicados."
              />
            )}
          </>
        )}
      </div>

      <ImportCfdiModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={(m) => notify('success', m)}
        onError={(m) => notify('error', m)}
      />

      <CfdiDetailModal id={detailId} isOpen={detailId !== null} onClose={() => setDetailId(null)} />

      <LinkInvoiceModal
        cfdiId={linkId}
        isOpen={linkId !== null}
        onClose={() => setLinkId(null)}
        onSuccess={(m) => notify('success', m)}
        onError={(m) => notify('error', m)}
      />

      <AssignClientModal
        cfdiId={assignTarget?.id ?? null}
        clienteActualId={assignTarget?.clienteId}
        isOpen={assignTarget !== null}
        onClose={() => setAssignTarget(null)}
        onSuccess={(m) => notify('success', m)}
        onError={(m) => notify('error', m)}
      />

      <GenerateInvoiceModal
        cfdi={generateTarget}
        onClose={() => setGenerateTarget(null)}
        onSuccess={(m) => notify('success', m)}
        onError={(m) => notify('error', m)}
      />

      <Toast
        isOpen={toast.open}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        variant={toast.variant}
        message={toast.message}
      />
    </PageLayout>
  )
}

interface GenerateInvoiceModalProps {
  cfdi: XmlComprobante | null
  onClose: () => void
  onSuccess: (m: string) => void
  onError: (m: string) => void
}

function GenerateInvoiceModal({ cfdi, onClose, onSuccess, onError }: GenerateInvoiceModalProps) {
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [notas, setNotas] = useState('')
  const generate = useGenerateInvoiceFromCfdi()

  const handleSubmit = async () => {
    if (!cfdi) return
    const payload: { fecha_vencimiento?: string; notas?: string } = {}
    if (fechaVencimiento) payload.fecha_vencimiento = fechaVencimiento
    if (notas.trim()) payload.notas = notas.trim()
    try {
      await generate.mutateAsync({ id: cfdi.id, ...payload })
      onSuccess('Factura generada desde el CFDI.')
      setFechaVencimiento('')
      setNotas('')
      onClose()
    } catch (err) {
      onError(parseApiError(err))
    }
  }

  const handleClose = () => {
    setFechaVencimiento('')
    setNotas('')
    onClose()
  }

  return (
    <Modal isOpen={cfdi !== null} onClose={handleClose} title="Generar factura desde CFDI" size="md">
      {cfdi && (
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <p className="text-sm">
              <span className="text-muted-foreground">Serie-Folio:</span>{' '}
              <strong>{cfdi.serie_folio ?? cfdi.uuid.slice(0, 8)}</strong>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Total:</span>{' '}
              <strong>{formatCurrency(cfdi.total)}</strong>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Receptor:</span> {cfdi.rfc_receptor}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Fecha de vencimiento (opcional)
            </label>
            <Input
              type="date"
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
              helperText="Por defecto es la fecha de emision del CFDI."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Notas (opcional)
            </label>
            <Input value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={handleClose} disabled={generate.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} loading={generate.isPending}>
              Generar factura
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
