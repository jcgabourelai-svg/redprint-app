import { useState } from 'react'
import { DollarSign, Eye, AlertCircle, FileText, CheckCircle, Clock } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { Card, CardContent } from '@/components/ui/Card'
import { formatCurrency, formatDate, getInvoiceStatusColor } from '@/lib/formatters'
import { useInvoices } from '@/hooks/useInvoices'
import type { Invoice } from '@/types/invoice'

const clientes = [
  { value: '', label: 'Todos los clientes' },
  { value: 'CLI-001', label: 'Empresa Alpha S.A. de C.V.' },
  { value: 'CLI-002', label: 'Grupo Beta México' },
  { value: 'CLI-003', label: 'Corporativo Gamma' },
  { value: 'CLI-004', label: 'Soluciones Delta S.C.' },
  { value: 'CLI-005', label: 'Tecnologías Epsilon' },
  { value: 'CLI-006', label: 'Industrias Zeta' },
]

function calcularDiasVencidos(fechaVencimiento: string): number {
  const hoy = new Date()
  const vencimiento = new Date(fechaVencimiento)
  const diff = hoy.getTime() - vencimiento.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function getDiasVencidosLabel(dias: number): { text: string; className: string } {
  if (dias <= 0) return { text: 'Vigente', className: 'text-green-600' }
  if (dias <= 15) return { text: `${dias} días`, className: 'text-yellow-600' }
  if (dias <= 30) return { text: `${dias} días`, className: 'text-orange-600' }
  return { text: `${dias} días`, className: 'text-red-600' }
}

export default function ReceivablesList() {
  const { data: invoicesData, isLoading, error } = useInvoices()
  const [statusFilter, setStatusFilter] = useState('')
  const [clienteFilter, setClienteFilter] = useState('')
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

  const invoices = invoicesData?.data || []
  const filteredInvoices = invoices
    .filter((inv) => (!statusFilter || inv.estado === statusFilter))
    .filter((inv) => (!clienteFilter || inv.cliente_id === clienteFilter))

  const totalPendiente = filteredInvoices.reduce((sum, inv) => sum + inv.saldo_pendiente, 0)
  const totalFacturado = filteredInvoices.reduce((sum, inv) => sum + inv.monto_total, 0)

  const columns = [
    {
      key: 'numero',
      label: 'Factura',
      sortable: true,
      render: (_value: string, row: Invoice) => (
        <div>
          <p className="font-medium text-gray-900">{row.numero}</p>
          <p className="text-xs text-gray-500">Emisión: {formatDate(row.fecha_emision)}</p>
          <p className="text-xs text-gray-400">Vence: {formatDate(row.fecha_vencimiento)}</p>
          {row.contrato_id && (
            <p className="text-xs text-gray-400 mt-1">Contrato: {row.contrato_id}</p>
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
          <p className="text-xs text-gray-500">{row.cliente_id}</p>
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
        <span className={`font-medium ${value > 0 ? 'text-red-600' : 'text-green-600'}`}>
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
          return <span className="text-sm text-gray-400">—</span>
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
            className="p-1 hover:bg-gray-100 rounded"
            title="Ver historial de pagos"
            onClick={(e) => {
              e.stopPropagation()
              setHistoryInvoice(row)
              setShowHistoryModal(true)
            }}
          >
            <Eye className="h-4 w-4 text-gray-500" />
          </button>
          {row.saldo_pendiente > 0 && (
            <button
              className="p-1 hover:bg-gray-100 rounded"
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
              <DollarSign className="h-4 w-4 text-green-500" />
            </button>
          )}
        </div>
      ),
    },
  ]

  const hasFilters = statusFilter || clienteFilter
  const clearFilters = () => {
    setStatusFilter('')
    setClienteFilter('')
  }

  return (
    <PageLayout title="Finanzas" showSearch>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Cuentas por Cobrar</h2>
            <p className="text-sm text-gray-500">
              Facturas emitidas y seguimiento de cobros a clientes
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Cargando facturas...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">Error al cargar facturas: {String(error)}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-50 p-2">
                      <FileText className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Facturado</p>
                      <p className="text-lg font-bold">{formatCurrency(totalFacturado)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-red-50 p-2">
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Vencidas</p>
                      <p className="text-lg font-bold text-red-600">
                        {invoices.filter(inv => inv.estado === 'VENCIDA').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-yellow-50 p-2">
                      <Clock className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Pendientes de Cobro</p>
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
                    <div className="rounded-lg bg-green-50 p-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total por Cobrar</p>
                      <p className="text-lg font-bold text-red-600">{formatCurrency(totalPendiente)}</p>
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
                    { value: 'pendiente', label: 'Pendiente' },
                    { value: 'parcialmente_pagada', label: 'Parcial' },
                    { value: 'pagada', label: 'Pagada' },
                    { value: 'vencida', label: 'Vencida' },
                  ]}
                  value={statusFilter}
                  onChange={setStatusFilter}
                  placeholder="Filtrar por estado"
                />
              </div>
              <div className="w-56">
                <Select
                  options={clientes}
                  value={clienteFilter}
                  onChange={setClienteFilter}
                  placeholder="Filtrar por cliente"
                />
              </div>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              )}
            </div>

            <Table
              data={filteredInvoices}
              columns={columns}
              searchable={true}
              sortable={true}
              paginatable={true}
              pageSize={10}
              emptyMessage="No hay cuentas por cobrar"
            />

            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Total por cobrar: <strong className="text-red-600">{formatCurrency(totalPendiente)}</strong></span>
              <span>Mostrando {filteredInvoices.length} de {invoices.length} facturas</span>
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
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">Factura: <strong>{selectedInvoice.numero}</strong></p>
              <p className="text-sm text-gray-600">Cliente: <strong>{selectedInvoice.cliente_nombre}</strong></p>
              <p className="text-sm text-gray-600">Monto total: <strong>{formatCurrency(selectedInvoice.monto_total)}</strong></p>
              <p className="text-sm text-gray-600">
                Saldo pendiente: <strong className="text-red-600">{formatCurrency(selectedInvoice.saldo_pendiente)}</strong>
              </p>
              <p className="text-sm text-gray-600">
                Vencimiento: <strong>{formatDate(selectedInvoice.fecha_vencimiento)}</strong>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del cobro *</label>
              <Input
                type="date"
                value={paymentForm.fecha}
                onChange={(e) => setPaymentForm({ ...paymentForm, fecha: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto ($) *</label>
              <Input
                type="number"
                value={paymentForm.monto}
                onChange={(e) => setPaymentForm({ ...paymentForm, monto: Number(e.target.value) })}
                helperText={`Máximo disponible: ${formatCurrency(selectedInvoice.saldo_pendiente)}`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Método de pago *</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta bancaria de destino</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Referencia</label>
                <Input
                  type="text"
                  value={paymentForm.referencia}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referencia: e.target.value })}
                  placeholder="Número de referencia o folio"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Socio que registra *</label>
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
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="grid grid-cols-2 gap-2">
                <p className="text-sm text-gray-600">Factura: <strong>{historyInvoice.numero}</strong></p>
                <p className="text-sm text-gray-600">Cliente: <strong>{historyInvoice.cliente_nombre}</strong></p>
                <p className="text-sm text-gray-600">Monto total: <strong>{formatCurrency(historyInvoice.monto_total)}</strong></p>
                <p className="text-sm text-gray-600">
                  Saldo pendiente: <strong className="text-red-600">{formatCurrency(historyInvoice.saldo_pendiente)}</strong>
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