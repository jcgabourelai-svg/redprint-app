import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Plus, Eye, DollarSign, Trash2, AlertCircle } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatCurrency, formatDate, getInvoiceStatusColor } from '@/lib/formatters'
import { useInvoices } from '@/hooks/useInvoices'
import type { Invoice } from '@/types/invoice'

export default function InvoiceList() {
  const { data: invoicesData, isLoading, error } = useInvoices()
  const [statusFilter, setStatusFilter] = useState('')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [paymentForm, setPaymentForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    monto: 0,
    metodo: 'EFECTIVO' as const,
    socio_registro: '',
  })
  const navigate = useNavigate()

  const invoices = invoicesData?.data || []
  const filteredInvoices = statusFilter
    ? invoices.filter((inv) => inv.estado === statusFilter)
    : invoices

  const totalPendiente = filteredInvoices.reduce((sum, inv) => sum + inv.saldo_pendiente, 0)

  const columns = [
    {
      key: 'numero',
      label: 'No. Factura',
      sortable: true,
      render: (_value: string, row: Invoice) => (
        <div>
          <p className="font-medium text-gray-900">{row.numero}</p>
          <p className="text-xs text-gray-500">Emisión: {formatDate(row.fecha_emision)}</p>
          <p className="text-xs text-gray-400">Vence: {formatDate(row.fecha_vencimiento)}</p>
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
        <span className={`font-medium ${value > 0 ? 'text-red-600' : 'text-green-600'}`}>
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
            title="Ver detalle"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/finanzas/facturas/${row.id}`)
            }}
          >
            <Eye className="h-4 w-4 text-gray-500" />
          </button>
          {row.saldo_pendiente > 0 && (
            <button
              className="p-1 hover:bg-gray-100 rounded"
              title="Registrar pago"
              onClick={(e) => {
                e.stopPropagation()
                setSelectedInvoice(row)
                setPaymentForm({ ...paymentForm, monto: row.saldo_pendiente })
                setShowPaymentModal(true)
              }}
            >
              <DollarSign className="h-4 w-4 text-green-500" />
            </button>
          )}
          <button className="p-1 hover:bg-gray-100 rounded" title="Eliminar">
            <Trash2 className="h-4 w-4 text-gray-500" />
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
            <h2 className="text-2xl font-bold text-gray-900">Cuentas por Cobrar</h2>
            <p className="text-sm text-gray-500">
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
                      <p className="text-sm text-gray-500">Total Facturas</p>
                      <p className="text-lg font-bold">{invoices.length}</p>
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
                      <p className="text-lg font-bold text-red-600">{invoices.filter(i => i.estado === 'VENCIDA').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-yellow-50 p-2">
                      <DollarSign className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Pendientes</p>
                      <p className="text-lg font-bold">{invoices.filter(i => i.estado === 'PENDIENTE' || i.estado === 'PARCIALMENTE_PAGADA').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-green-50 p-2">
                      <DollarSign className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Saldo Pendiente</p>
                      <p className="text-lg font-bold text-red-600">{formatCurrency(totalPendiente)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center gap-4">
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
              {statusFilter && (
                <Button variant="ghost" size="sm" onClick={() => setStatusFilter('')}>
                  Limpiar filtro
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
              emptyMessage="No hay facturas registradas"
            />

            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Total pendiente: <strong className="text-red-600">{formatCurrency(totalPendiente)}</strong></span>
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
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">Factura: <strong>{selectedInvoice.numero}</strong></p>
              <p className="text-sm text-gray-600">Cliente: <strong>{selectedInvoice.cliente_nombre}</strong></p>
              <p className="text-sm text-gray-600">Monto total: <strong>{formatCurrency(selectedInvoice.monto_total)}</strong></p>
              <p className="text-sm text-gray-600">Saldo pendiente: <strong className="text-red-600">{formatCurrency(selectedInvoice.saldo_pendiente)}</strong></p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del pago *</label>
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
                onChange={(v) => setPaymentForm({ ...paymentForm, metodo: v as any })}
              />
            </div>

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
              <Button variant="secondary" onClick={() => setShowPaymentModal(false)}>
                Cancelar
              </Button>
              <Button onClick={() => setShowPaymentModal(false)}>
                Registrar Pago
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageLayout>
  )
}
