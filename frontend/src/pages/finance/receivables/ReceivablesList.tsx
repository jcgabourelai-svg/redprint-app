import { useState } from 'react'
import { DollarSign, Eye, AlertCircle, FileText, CheckCircle, Clock, Wallet } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Table from '@/components/ui/Table'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { Card, CardContent } from '@/components/ui/Card'
import { formatCurrency, formatDate, getInvoiceStatusColor, parseDate } from '@/lib/formatters'
import api from '@/lib/api'
import { useServerTable } from '@/hooks/useServerTable'
import type { Invoice } from '@/types/invoice'

function calcularDiasVencidos(fechaVencimiento: string): number {
  const hoy = new Date()
  const vencimiento = parseDate(fechaVencimiento)
  const diff = hoy.getTime() - vencimiento.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function getDiasVencidosLabel(dias: number): { text: string; className: string } {
  if (dias <= 0) return { text: 'Vigente', className: 'text-success' }
  if (dias <= 15) return { text: `${dias} días`, className: 'text-warning' }
  if (dias <= 30) return { text: `${dias} días`, className: 'text-warning' }
  return { text: `${dias} días`, className: 'text-destructive' }
}

export default function ReceivablesList() {
  const { data: invoices, tableProps, isLoading, error, hasActiveFilters } = useServerTable<Invoice>({
    queryKey: ['invoices'],
    fetcher: (p) => api.get('/invoices', { params: p }).then((r) => r.data),
  })
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyInvoice, setHistoryInvoice] = useState<Invoice | null>(null)
  const [paymentForm, setPaymentForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    monto: 0,
    metodo: 'TRANSFERENCIA' as 'EFECTIVO' | 'TRANSFERENCIA' | 'DEPOSITO',
    cuenta_bancaria: '',
    socio_registro: '',
    referencia: '',
  })

  const totalPendiente = invoices.reduce((sum, inv) => sum + inv.saldo_pendiente, 0)
  const totalFacturado = invoices.reduce((sum, inv) => sum + inv.monto_total, 0)

  const columns = [
    {
      key: 'numero',
      label: 'Factura',
      sortable: true,
      render: (_value: string, row: Invoice) => (
        <div>
          <p className="font-medium text-foreground">{row.numero}</p>
          <p className="text-xs text-muted-foreground">Emisión: {formatDate(row.fecha_emision)}</p>
          <p className="text-xs text-muted-foreground">Vence: {formatDate(row.fecha_vencimiento)}</p>
          {row.contrato_id && (
            <p className="text-xs text-muted-foreground mt-1">Contrato: {row.contrato_id}</p>
          )}
        </div>
      ),
    },
    {
      key: 'cliente_nombre',
      label: 'Cliente',
      sortable: true,
      render: (_value: string, row: Invoice) => (
        <div>
          <p className="font-medium">{row.cliente_nombre}</p>
          <p className="text-xs text-muted-foreground">{row.cliente_id}</p>
        </div>
      ),
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
      key: 'fecha_vencimiento',
      label: 'Antigüedad',
      sortable: true,
      render: (value: string, row: Invoice) => {
        if (row.estado === 'PAGADA') {
          return <span className="text-sm text-muted-foreground">—</span>
        }
        const dias = calcularDiasVencidos(value)
        const { text, className } = getDiasVencidosLabel(dias)
        return (
          <div>
            <span className={`text-sm font-medium ${className}`}>{text}</span>
          </div>
        )
      },
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      render: (value: string) => (
        <Badge className={getInvoiceStatusColor(value)}>
          {value}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (_value: unknown, row: Invoice) => (
        <div className="flex items-center gap-1">
          <button
            className="p-1 hover:bg-muted rounded"
            title="Ver historial de pagos"
            onClick={(e) => {
              e.stopPropagation()
              setHistoryInvoice(row)
              setShowHistoryModal(true)
            }}
          >
            <Eye className="h-4 w-4 text-muted-foreground" />
          </button>
          {row.saldo_pendiente > 0 && (
            <button
              className="p-1 hover:bg-muted rounded"
              title="Registrar cobro"
              onClick={(e) => {
                e.stopPropagation()
                setSelectedInvoice(row)
                setPaymentForm({
                  fecha: new Date().toISOString().split('T')[0],
                  monto: row.saldo_pendiente,
                  metodo: 'TRANSFERENCIA',
                  cuenta_bancaria: '',
                  socio_registro: '',
                  referencia: '',
                })
                setShowPaymentModal(true)
              }}
            >
              <DollarSign className="h-4 w-4 text-success" />
            </button>
          )}
        </div>
      ),
    },
  ]

  const hasFilters = (tableProps.filterState.estado || '') !== ''

  return (
    <PageLayout title="Finanzas" showSearch>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Cuentas por Cobrar</h2>
            <p className="text-sm text-muted-foreground">
              Facturas emitidas y seguimiento de cobros a clientes
            </p>
          </div>
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
                      <p className="text-sm text-muted-foreground">Total Facturado</p>
                      <p className="text-lg font-bold">{formatCurrency(totalFacturado)}</p>
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
                      <p className="text-lg font-bold text-destructive">
                        {invoices.filter(inv => inv.estado === 'VENCIDA').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-warning/10 p-2">
                      <Clock className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pendientes de Cobro</p>
                      <p className="text-lg font-bold">
                        {invoices.filter(inv => inv.estado === 'PENDIENTE' || inv.estado === 'PARCIALMENTE_PAGADA').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-success/10 p-2">
                      <CheckCircle className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total por Cobrar</p>
                      <p className="text-lg font-bold text-destructive">{formatCurrency(totalPendiente)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-48">
                <Select
                  options={[
                    { value: '', label: 'Todos los estados' },
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
              </div>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={() => tableProps.onFilterChange({ ...tableProps.filterState, estado: '' })}>
                  Limpiar filtros
                </Button>
              )}
            </div>

            {invoices.length === 0 && !hasActiveFilters ? (
              <EmptyState
                icon={Wallet}
                title="No hay cuentas por cobrar"
                description="Se generan automáticamente al registrar facturas."
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
              <span>Total por cobrar: <strong className="text-destructive">{formatCurrency(totalPendiente)}</strong></span>
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Registrar Cobro de Cliente"
        size="lg"
      >
        {selectedInvoice && (
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Factura: <strong>{selectedInvoice.numero}</strong></p>
              <p className="text-sm text-muted-foreground">Cliente: <strong>{selectedInvoice.cliente_nombre}</strong></p>
              <p className="text-sm text-muted-foreground">Monto total: <strong>{formatCurrency(selectedInvoice.monto_total)}</strong></p>
              <p className="text-sm text-muted-foreground">
                Saldo pendiente: <strong className="text-destructive">{formatCurrency(selectedInvoice.saldo_pendiente)}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Vencimiento: <strong>{formatDate(selectedInvoice.fecha_vencimiento)}</strong>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Fecha del cobro *</label>
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
                onChange={(v) => setPaymentForm({ ...paymentForm, metodo: v as 'EFECTIVO' | 'TRANSFERENCIA' | 'DEPOSITO' })}
              />
            </div>

            {(paymentForm.metodo === 'TRANSFERENCIA' || paymentForm.metodo === 'DEPOSITO') && (
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Cuenta bancaria de destino</label>
                <Select
                  options={[
                    { value: 'cuenta-1', label: 'Cuenta principal - BBVA' },
                    { value: 'cuenta-2', label: 'Cuenta secundaria - Banorte' },
                  ]}
                  value={paymentForm.cuenta_bancaria}
                  onChange={(v) => setPaymentForm({ ...paymentForm, cuenta_bancaria: v })}
                  placeholder="Seleccionar cuenta"
                />
              </div>
            )}

            {(paymentForm.metodo === 'TRANSFERENCIA' || paymentForm.metodo === 'DEPOSITO') && (
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Referencia</label>
                <Input
                  type="text"
                  value={paymentForm.referencia}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referencia: e.target.value })}
                  placeholder="Número de referencia o folio"
                />
              </div>
            )}

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
              <Button variant="secondary" onClick={() => setShowPaymentModal(false)}>Cancelar</Button>
              <Button onClick={() => setShowPaymentModal(false)}>Registrar Cobro</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title="Historial de Pagos"
        size="lg"
      >
        {historyInvoice && (
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-lg">
              <div className="grid grid-cols-2 gap-2">
                <p className="text-sm text-muted-foreground">Factura: <strong>{historyInvoice.numero}</strong></p>
                <p className="text-sm text-muted-foreground">Cliente: <strong>{historyInvoice.cliente_nombre}</strong></p>
                <p className="text-sm text-muted-foreground">Monto total: <strong>{formatCurrency(historyInvoice.monto_total)}</strong></p>
                <p className="text-sm text-muted-foreground">
                  Saldo pendiente: <strong className="text-destructive">{formatCurrency(historyInvoice.saldo_pendiente)}</strong>
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button variant="secondary" onClick={() => setShowHistoryModal(false)}>Cerrar</Button>
            </div>
          </div>
        )}
      </Modal>
    </PageLayout>
  )
}