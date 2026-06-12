import { useState } from 'react'
import { DollarSign, Eye, AlertCircle, CreditCard, CheckCircle } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { Card, CardContent } from '@/components/ui/Card'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { usePayments } from '@/hooks/usePayments'
import type { Payment } from '@/types/payment'

export default function PaymentList() {
  const { data: paymentsData, isLoading, error } = usePayments()
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [paymentForm, setPaymentForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    monto: 0,
    metodo: 'TRANSFERENCIA' as 'EFECTIVO' | 'TRANSFERENCIA' | 'DEPOSITO',
    cuenta_bancaria: '',
    socio_registro: '',
  })

  const payments = paymentsData?.data || []
  const totalPagado = payments.reduce((sum, p) => sum + p.monto, 0)

  const columns = [
    {
      key: 'fecha',
      label: 'Fecha',
      sortable: true,
      render: (value: string) => formatDate(value),
    },
    {
      key: 'monto',
      label: 'Monto',
      sortable: true,
      render: (value: number) => (
        <span className="font-medium">{formatCurrency(value)}</span>
      ),
    },
    {
      key: 'metodo',
      label: 'Método',
      sortable: true,
      render: (value: string) => (
        <Badge className="bg-gray-100 text-gray-800">
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'socio_registro',
      label: 'Registrado por',
      sortable: true,
    },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (_value: unknown, row: Payment) => (
        <div className="flex items-center gap-1">
          <button className="p-1 hover:bg-gray-100 rounded" title="Ver detalle">
            <Eye className="h-4 w-4 text-gray-500" />
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
            <h2 className="text-2xl font-bold text-gray-900">Historial de Pagos</h2>
            <p className="text-sm text-gray-500">
              Pagos registrados en el sistema
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Cargando pagos...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">Error al cargar pagos: {String(error)}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-50 p-2">
                      <CreditCard className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Pagos</p>
                      <p className="text-lg font-bold">{payments.length}</p>
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
                      <p className="text-sm text-gray-500">Total Pagado</p>
                      <p className="text-lg font-bold text-green-600">{formatCurrency(totalPagado)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-purple-50 p-2">
                      <CheckCircle className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Último Pago</p>
                      <p className="text-lg font-bold">
                        {payments.length > 0 ? formatDate(payments[0].fecha) : '-'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Table
              data={payments}
              columns={columns}
              searchable={true}
              sortable={true}
              paginatable={true}
              pageSize={10}
              emptyMessage="No hay pagos registrados"
            />

            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Total pagado: <strong className="text-green-600">{formatCurrency(totalPagado)}</strong></span>
              <span>Mostrando {payments.length} pagos</span>
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Detalle del Pago"
        size="lg"
      >
        {selectedPayment && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">Fecha: <strong>{formatDate(selectedPayment.fecha)}</strong></p>
              <p className="text-sm text-gray-600">Monto: <strong>{formatCurrency(selectedPayment.monto)}</strong></p>
              <p className="text-sm text-gray-600">Método: <strong>{selectedPayment.metodo}</strong></p>
              <p className="text-sm text-gray-600">Registrado por: <strong>{selectedPayment.socio_registro}</strong></p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => setShowPaymentModal(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageLayout>
  )
}