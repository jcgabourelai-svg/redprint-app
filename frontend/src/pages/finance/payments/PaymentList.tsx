import { useState } from 'react'
import { DollarSign, Eye, AlertCircle, CreditCard, CheckCircle } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Table from '@/components/ui/Table'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { Card, CardContent } from '@/components/ui/Card'
import { formatCurrency, formatDate } from '@/lib/formatters'
import api from '@/lib/api'
import { useServerTable } from '@/hooks/useServerTable'
import type { Payment } from '@/types/payment'

export default function PaymentList() {
  const { data: payments, tableProps, isLoading, error, hasActiveFilters } = useServerTable<Payment>({
    queryKey: ['payments'],
    fetcher: (p) => api.get('/payments', { params: p }).then((r) => r.data),
    defaultSort: { column: 'fecha', dir: 'desc' },
  })
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [paymentForm, setPaymentForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    monto: 0,
    metodo: 'TRANSFERENCIA' as 'EFECTIVO' | 'TRANSFERENCIA' | 'DEPOSITO',
    cuenta_bancaria: '',
    socio_registro: '',
  })

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
        <Badge className="bg-muted text-foreground">
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
          <button className="p-1 hover:bg-muted rounded" title="Ver detalle">
            <Eye className="h-4 w-4 text-muted-foreground" />
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
            <h2 className="text-2xl font-bold text-foreground">Historial de Pagos</h2>
            <p className="text-sm text-muted-foreground">
              Pagos registrados en el sistema
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Cargando pagos...</p>
          </div>
        ) : error ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-destructive">Error al cargar pagos: {String(error)}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Pagos</p>
                      <p className="text-lg font-bold">{payments.length}</p>
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
                      <p className="text-sm text-muted-foreground">Total Pagado</p>
                      <p className="text-lg font-bold text-success">{formatCurrency(totalPagado)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <CheckCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Último Pago</p>
                      <p className="text-lg font-bold">
                        {payments.length > 0 ? formatDate(payments[0].fecha) : '-'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {payments.length === 0 && !hasActiveFilters ? (
              <EmptyState
                icon={CreditCard}
                title="No hay pagos"
                description="Los pagos se registran desde el detalle de facturas y compras."
              />
            ) : (
              <Table
                data={payments}
                columns={columns}
                searchable={true}
                sortable={true}
                paginatable={true}
                {...tableProps}
                emptyMessage="No se encontraron pagos con los filtros aplicados."
              />
            )}

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Total pagado: <strong className="text-success">{formatCurrency(totalPagado)}</strong></span>
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
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Fecha: <strong>{formatDate(selectedPayment.fecha)}</strong></p>
              <p className="text-sm text-muted-foreground">Monto: <strong>{formatCurrency(selectedPayment.monto)}</strong></p>
              <p className="text-sm text-muted-foreground">Método: <strong>{selectedPayment.metodo}</strong></p>
              <p className="text-sm text-muted-foreground">Registrado por: <strong>{selectedPayment.socio_registro}</strong></p>
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