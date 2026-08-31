import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Plus, Eye, DollarSign, Trash2, AlertCircle, Receipt } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Table from '@/components/ui/Table'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Toast from '@/components/ui/Toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatCurrency, formatDate, getInvoiceStatusColor } from '@/lib/formatters'
import { InvoiceStatusLabels } from '@/types/enums'
import api from '@/lib/api'
import { useServerTable } from '@/hooks/useServerTable'
import { useCreatePayment } from '@/hooks/usePayments'
import type { Invoice } from '@/types/invoice'

export default function InvoiceList() {
  const { data: invoices, tableProps, isLoading, error, hasActiveFilters } = useServerTable<Invoice>({
    queryKey: ['invoices'],
    fetcher: (p) => api.get('/invoices', { params: p }).then((r) => r.data),
  })
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [paymentForm, setPaymentForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    monto: 0,
    metodo: 'EFECTIVO' as const,
    socio_registro: '',
  })
  const navigate = useNavigate()
  const createPayment = useCreatePayment()
  const [toast, setToast] = useState<{ open: boolean; variant: 'success' | 'error'; message: string }>({
    open: false,
    variant: 'success',
    message: '',
  })

  const totalPendiente = invoices.reduce((sum, inv) => sum + inv.saldo_pendiente, 0)

  const handleRegisterPayment = async () => {
    if (!selectedInvoice) return
    if (!paymentForm.monto || paymentForm.monto <= 0) {
      setToast({ open: true, variant: 'error', message: 'El monto debe ser mayor a 0.' })
      return
    }
    if (paymentForm.monto > selectedInvoice.saldo_pendiente) {
      setToast({ open: true, variant: 'error', message: 'El monto excede el saldo pendiente.' })
      return
    }
    try {
      await createPayment.mutateAsync({
        factura_id: selectedInvoice.id,
        fecha: paymentForm.fecha,
        monto: paymentForm.monto,
        metodo_pago: paymentForm.metodo,
      })
      setShowPaymentModal(false)
      setToast({ open: true, variant: 'success', message: 'Pago registrado correctamente.' })
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message
      setToast({
        open: true,
        variant: 'error',
        message: backendMessage || 'No se pudo registrar el pago. Verifica los datos.',
      })
    }
  }

  const columns = [
    {
      key: 'numero',
      label: 'No. Factura',
      sortable: true,
      render: (_value: string, row: Invoice) => (
        <div>
          <p className="font-medium text-foreground">{row.numero}</p>
          <p className="text-xs text-muted-foreground">Emisión: {formatDate(row.fecha_emision)}</p>
          <p className="text-xs text-muted-foreground">Vence: {formatDate(row.fecha_vencimiento)}</p>
        </div>
      ),
    },
    {
      key: 'cliente_nombre',
      label: 'Cliente',
      sortable: true,
    },
    {
      key: 'monto_total',
      label: 'Monto Total',
      sortable: true,
      render: (value: number) => (
        <span className="font-medium">{formatCurrency(value)}</span>
      ),
    },
    {
      key: 'saldo_pendiente',
      label: 'Saldo Pendiente',
      sortable: true,
      render: (value: number) => (
        <span className={`font-medium ${value > 0 ? 'text-destructive' : 'text-success'}`}>
          {formatCurrency(value)}
        </span>
      ),
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      render: (value: string) => (
        <Badge className={getInvoiceStatusColor(value)}>
          {(InvoiceStatusLabels as Record<string, string>)[value] || value}
        </Badge>
      ),
    },
    {
      key: 'xml_comprobante_id',
      label: 'CFDI',
      render: (_value: unknown, row: Invoice) =>
        row.xml_comprobante_id ? (
          <Badge variant="success">Conciliado</Badge>
        ) : (
          <Badge variant="neutral">Sin XML</Badge>
        ),
    },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (_value: unknown, row: Invoice) => (
        <div className="flex items-center gap-1">
          <button
            className="p-1 hover:bg-muted rounded"
            title="Ver detalle"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/finanzas/facturas/${row.id}`)
            }}
          >
            <Eye className="h-4 w-4 text-muted-foreground" />
          </button>
          {row.saldo_pendiente > 0 && (
            <button
              className="p-1 hover:bg-muted rounded"
              title="Registrar pago"
              onClick={(e) => {
                e.stopPropagation()
                setSelectedInvoice(row)
                setPaymentForm({ ...paymentForm, monto: row.saldo_pendiente })
                setShowPaymentModal(true)
              }}
            >
              <DollarSign className="h-4 w-4 text-success" />
            </button>
          )}
          <button className="p-1 hover:bg-muted rounded" title="Eliminar">
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <PageLayout title="Finanzas" showSearch>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Cuentas por Cobrar</h2>
            <p className="text-sm text-muted-foreground">
              Facturas emitidas y seguimiento de pagos
            </p>
          </div>
          <Button onClick={() => navigate('/finanzas/facturas/registrar')}>
            <Plus className="mr-2 h-4 w-4" />
            Registrar Factura
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Cargando facturas...</p>
          </div>
        ) : error ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-destructive">Error al cargar facturas: {String(error)}</p>
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
                      <p className="text-sm text-muted-foreground">Total Facturas</p>
                      <p className="text-lg font-bold">{invoices.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-destructive/10 p-2">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Vencidas</p>
                      <p className="text-lg font-bold text-destructive">{invoices.filter(i => i.estado === 'VENCIDA').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-warning/10 p-2">
                      <DollarSign className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pendientes</p>
                      <p className="text-lg font-bold">{invoices.filter(i => i.estado === 'PENDIENTE' || i.estado === 'PARCIALMENTE_PAGADA').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-success/10 p-2">
                      <DollarSign className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Saldo Pendiente</p>
                      <p className="text-lg font-bold text-destructive">{formatCurrency(totalPendiente)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center gap-4">
              <Select
                options={[
                  { value: '', label: 'Todos los estados' },
                  { value: 'BORRADOR', label: 'Borrador' },
                  { value: 'PENDIENTE', label: 'Pendiente' },
                  { value: 'PARCIALMENTE_PAGADA', label: 'Parcial' },
                  { value: 'PAGADA', label: 'Pagada' },
                  { value: 'VENCIDA', label: 'Vencida' },
                  { value: 'INCOBRABLE', label: 'Incobrable' },
                ]}
                value={tableProps.filterState.estado || ''}
                onChange={(v) => tableProps.onFilterChange({ ...tableProps.filterState, estado: v })}
                placeholder="Filtrar por estado"
              />
              {(tableProps.filterState.estado || '') !== '' && (
                <Button variant="ghost" size="sm" onClick={() => tableProps.onFilterChange({ ...tableProps.filterState, estado: '' })}>
                  Limpiar filtro
                </Button>
              )}
            </div>

            {invoices.length === 0 && !hasActiveFilters ? (
              <EmptyState
                icon={Receipt}
                title="No hay facturas"
                description="Registra una factura para iniciar la facturación."
                action={{ label: 'Registrar Factura', onClick: () => navigate('/finanzas/facturas/registrar') }}
              />
            ) : (
              <Table
                data={invoices}
                columns={columns}
                searchable={true}
                sortable={true}
                paginatable={true}
                {...tableProps}
                emptyMessage="No se encontraron facturas con los filtros aplicados."
              />
            )}

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Total pendiente: <strong className="text-destructive">{formatCurrency(totalPendiente)}</strong></span>
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Registrar Pago"
        size="lg"
      >
        {selectedInvoice && (
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Factura: <strong>{selectedInvoice.numero}</strong></p>
              <p className="text-sm text-muted-foreground">Cliente: <strong>{selectedInvoice.cliente_nombre}</strong></p>
              <p className="text-sm text-muted-foreground">Monto total: <strong>{formatCurrency(selectedInvoice.monto_total)}</strong></p>
              <p className="text-sm text-muted-foreground">Saldo pendiente: <strong className="text-destructive">{formatCurrency(selectedInvoice.saldo_pendiente)}</strong></p>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Fecha del pago *</label>
              <Input
                type="date"
                value={paymentForm.fecha}
                onChange={(e) => setPaymentForm({ ...paymentForm, fecha: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Monto ($) *</label>
              <Input
                type="number"
                value={paymentForm.monto}
                onChange={(e) => setPaymentForm({ ...paymentForm, monto: Number(e.target.value) })}
                helperText={`Máximo disponible: ${formatCurrency(selectedInvoice.saldo_pendiente)}`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Método de pago *</label>
              <Select
                options={[
                  { value: 'EFECTIVO', label: 'Efectivo' },
                  { value: 'TRANSFERENCIA', label: 'Transferencia' },
                  { value: 'DEPOSITO', label: 'Depósito' },
                ]}
                value={paymentForm.metodo}
                onChange={(v) => setPaymentForm({ ...paymentForm, metodo: v as any })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Socio que registra *</label>
              <Select
                options={[
                  { value: 'socio1', label: 'María López' },
                  { value: 'socio2', label: 'Juan Pérez' },
                  { value: 'socio3', label: 'Carlos Gómez' },
                ]}
                value={paymentForm.socio_registro}
                onChange={(v) => setPaymentForm({ ...paymentForm, socio_registro: v })}
                placeholder="Seleccionar socio"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setShowPaymentModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleRegisterPayment} loading={createPayment.isPending}>
                Registrar Pago
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Toast
        isOpen={toast.open}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        variant={toast.variant}
        message={toast.message}
      />
    </PageLayout>
  )
}
