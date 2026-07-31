import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, DollarSign, AlertCircle, Printer, Calendar } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Toast from '@/components/ui/Toast'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Tabs from '@/components/ui/Tabs'
import api from '@/lib/api'
import { formatCurrency, formatDate, getInvoiceStatusColor } from '@/lib/formatters'
import { useCreatePayment } from '@/hooks/usePayments'

interface InvoiceDetailLine {
  factura_id: string
  contrato_id?: number | null
  impresora_id?: number | null
  lectura_id?: number | null
  paginas_consumidas: number
  monto_calculado: number
}

interface InvoicePayment {
  id: string
  fecha: string
  monto: number
  metodo_pago?: string
  nota?: string
  socio?: { id?: string; name?: string; nombre?: string } | null
}

interface InvoiceFull {
  id: string
  numero_factura: string
  cliente_id: string
  fecha_emision?: string
  fecha_vencimiento?: string
  periodo_inicio?: string
  periodo_fin?: string
  monto_total: number
  monto_pagado: number
  saldo_pendiente: number
  estado?: string
  notas?: string
  xml_comprobante_id?: number | null
  client?: { razon_social?: string; rfc?: string } | null
  details?: InvoiceDetailLine[]
  payments?: InvoicePayment[]
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: invoice, isLoading, error } = useQuery<InvoiceFull>({
    queryKey: ['invoices', id],
    queryFn: () => api.get(`/invoices/${id}`).then((r) => r.data),
    enabled: !!id,
  })

  const createPayment = useCreatePayment()
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    monto: 0,
    metodo: 'EFECTIVO' as const,
  })
  const [toast, setToast] = useState<{ open: boolean; variant: 'success' | 'error'; message: string }>({
    open: false,
    variant: 'success',
    message: '',
  })

  if (isLoading) {
    return (
      <PageLayout title="Cargando...">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Cargando factura...</p>
        </div>
      </PageLayout>
    )
  }

  if (error || !invoice) {
    return (
      <PageLayout title="Factura no encontrada">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Factura no encontrada</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate('/finanzas/facturas')}>
            Volver a facturas
          </Button>
        </div>
      </PageLayout>
    )
  }

  const clienteNombre = invoice.client?.razon_social || `Cliente ${invoice.cliente_id}`
  const porcentajePagado =
    invoice.monto_total > 0
      ? Math.round(((invoice.monto_total - invoice.saldo_pendiente) / invoice.monto_total) * 100)
      : 0
  const detalles = invoice.details || []
  const pagos = invoice.payments || []

  const openPaymentModal = () => {
    setPaymentForm({ fecha: new Date().toISOString().split('T')[0], monto: invoice.saldo_pendiente, metodo: 'EFECTIVO' })
    setShowPaymentModal(true)
  }

  const handleRegisterPayment = async () => {
    if (!paymentForm.monto || paymentForm.monto <= 0) {
      setToast({ open: true, variant: 'error', message: 'El monto debe ser mayor a 0.' })
      return
    }
    if (paymentForm.monto > invoice.saldo_pendiente) {
      setToast({ open: true, variant: 'error', message: 'El monto excede el saldo pendiente.' })
      return
    }
    try {
      await createPayment.mutateAsync({
        factura_id: invoice.id,
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

  return (
    <PageLayout title={`Finanzas › Facturas › ${invoice.numero_factura}`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/finanzas/facturas')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          {invoice.saldo_pendiente > 0 && (
            <Button size="sm" onClick={openPaymentModal}>
              <DollarSign className="mr-2 h-4 w-4" />
              Registrar pago
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded bg-primary/10">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">{invoice.numero_factura}</CardTitle>
                  <p className="text-sm text-muted-foreground">{clienteNombre}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge className={getInvoiceStatusColor(invoice.estado || '')}>
                  {invoice.estado || '-'}
                </Badge>
                {invoice.xml_comprobante_id ? (
                  <Badge variant="success">CFDI conciliado</Badge>
                ) : (
                  <Badge variant="neutral">Sin XML</Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase text-muted-foreground">Datos de la Factura</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="text-sm font-medium">{clienteNombre}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">RFC</p>
                  <p className="text-sm font-medium">{invoice.client?.rfc || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Período facturado</p>
                  <p className="text-sm font-medium">
                    {invoice.periodo_inicio ? formatDate(invoice.periodo_inicio) : '-'}
                    {' — '}
                    {invoice.periodo_fin ? formatDate(invoice.periodo_fin) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Notas</p>
                  <p className="text-sm font-medium">{invoice.notas || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase text-muted-foreground">Fechas y Montos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Fecha de emisión</p>
                  <p className="text-sm font-medium">{formatDate(invoice.fecha_emision)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fecha de vencimiento</p>
                  <p className="text-sm font-medium">{formatDate(invoice.fecha_vencimiento)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monto total</p>
                  <p className="text-sm font-bold">{formatCurrency(invoice.monto_total)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Saldo pendiente</p>
                  <p className={`text-sm font-bold ${invoice.saldo_pendiente > 0 ? 'text-destructive' : 'text-success'}`}>
                    {formatCurrency(invoice.saldo_pendiente)}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Progreso de pago</span>
                  <span>{porcentajePagado}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${porcentajePagado === 100 ? 'bg-success' : porcentajePagado > 0 ? 'bg-primary' : 'bg-border'}`}
                    style={{ width: `${porcentajePagado}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 grid-cols-2 lg:grid-cols-4">
          <div className="text-center p-4 bg-primary/10 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Monto Total</p>
            <p className="text-xl font-bold text-primary">{formatCurrency(invoice.monto_total)}</p>
          </div>
          <div className="text-center p-4 bg-success/10 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Pagado</p>
            <p className="text-xl font-bold text-success">{formatCurrency(invoice.monto_pagado)}</p>
          </div>
          <div className="text-center p-4 bg-destructive/10 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Saldo Pendiente</p>
            <p className="text-xl font-bold text-destructive">{formatCurrency(invoice.saldo_pendiente)}</p>
          </div>
          <div className="text-center p-4 bg-primary/10 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Pagos</p>
            <p className="text-xl font-bold text-primary">{pagos.length}</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="p-6 pb-0">
              <Tabs
                tabs={[
                  {
                    id: 'detalles',
                    label: `Detalle (${detalles.length})`,
                    content: (
                      <div className="pb-4">
                        {detalles.length === 0 ? (
                          <div className="text-center py-8">
                            <Printer className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                            <p className="text-muted-foreground">No hay líneas de detalle registradas</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border">
                                  <th className="pb-2 text-left text-xs font-medium text-muted-foreground">Impresora / Contrato</th>
                                  <th className="pb-2 text-right text-xs font-medium text-muted-foreground">Páginas</th>
                                  <th className="pb-2 text-right text-xs font-medium text-muted-foreground">Monto</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detalles.map((d, i) => (
                                  <tr key={i} className="border-b border-border">
                                    <td className="py-2">
                                      <p className="font-medium text-foreground">
                                        Impresora {d.impresora_id ?? '-'}
                                      </p>
                                      {d.contrato_id && (
                                        <p className="text-xs text-muted-foreground">Contrato {d.contrato_id}</p>
                                      )}
                                    </td>
                                    <td className="py-2 text-right text-muted-foreground">{d.paginas_consumidas}</td>
                                    <td className="py-2 text-right font-medium">{formatCurrency(d.monto_calculado)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t border-border">
                                  <td colSpan={2} className="pt-2 text-right text-sm font-medium text-muted-foreground">
                                    Total detalle:
                                  </td>
                                  <td className="pt-2 text-right font-bold">
                                    {formatCurrency(detalles.reduce((s, d) => s + Number(d.monto_calculado), 0))}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
                    ),
                  },
                  {
                    id: 'pagos',
                    label: `Pagos (${pagos.length})`,
                    content: (
                      <div className="pb-4">
                        {pagos.length === 0 ? (
                          <div className="text-center py-8">
                            <DollarSign className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                            <p className="text-muted-foreground">No hay pagos registrados</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border">
                                  <th className="pb-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                                  <th className="pb-2 text-left text-xs font-medium text-muted-foreground">Método</th>
                                  <th className="pb-2 text-left text-xs font-medium text-muted-foreground">Socio</th>
                                  <th className="pb-2 text-right text-xs font-medium text-muted-foreground">Monto</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pagos.map((p) => (
                                  <tr key={p.id} className="border-b border-border">
                                    <td className="py-2 text-muted-foreground">
                                      <span className="inline-flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {formatDate(p.fecha)}
                                      </span>
                                    </td>
                                    <td className="py-2 text-muted-foreground">{p.metodo_pago || '-'}</td>
                                    <td className="py-2 text-muted-foreground">
                                      {p.socio?.name || p.socio?.nombre || '-'}
                                    </td>
                                    <td className="py-2 text-right font-medium text-success">{formatCurrency(p.monto)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t border-border">
                                  <td colSpan={3} className="pt-2 text-right text-sm font-medium text-muted-foreground">
                                    Total pagado:
                                  </td>
                                  <td className="pt-2 text-right font-bold">
                                    {formatCurrency(pagos.reduce((s, p) => s + Number(p.monto), 0))}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
                    ),
                  },
                  {
                    id: 'estado',
                    label: 'Estado',
                    content: (
                      <div className="pb-4">
                        {invoice.notas ? (
                          <div className="bg-muted rounded-lg p-4">
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notas}</p>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                            <p className="text-muted-foreground">Sin notas adicionales</p>
                          </div>
                        )}
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Registrar Pago"
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-sm text-muted-foreground">Factura: <strong>{invoice.numero_factura}</strong></p>
            <p className="text-sm text-muted-foreground">Cliente: <strong>{clienteNombre}</strong></p>
            <p className="text-sm text-muted-foreground">Monto total: <strong>{formatCurrency(invoice.monto_total)}</strong></p>
            <p className="text-sm text-muted-foreground">Saldo pendiente: <strong className="text-destructive">{formatCurrency(invoice.saldo_pendiente)}</strong></p>
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
              helperText={`Máximo disponible: ${formatCurrency(invoice.saldo_pendiente)}`}
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

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowPaymentModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRegisterPayment} loading={createPayment.isPending}>
              Registrar Pago
            </Button>
          </div>
        </div>
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
