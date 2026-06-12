import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { usePurchase, useReceivePurchase, useCancelPurchase } from '@/hooks/usePurchases'
import { useCreateSupplierPayment } from '@/hooks/useSupplierPayments'
import { PurchaseStatus, PURCHASE_STATUS_LABELS, SupplierPaymentMethod } from '@/types/enums'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { formatCurrency, formatDate } from '@/lib/utils'

const statusBadgeVariant: Record<string, 'default' | 'success' | 'warning'> = {
  PENDIENTE: 'warning',
  RECIBIDA: 'success',
  CANCELADA: 'default',
}

const methodOptions = Object.values(SupplierPaymentMethod).map((m) => ({
  value: m,
  label: m.charAt(0) + m.slice(1).toLowerCase(),
}))

export default function PurchaseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const purchaseId = Number(id)

  const { data: purchase, isLoading, isError, refetch } = usePurchase(purchaseId)
  const receiveMutation = useReceivePurchase()
  const cancelMutation = useCancelPurchase()
  const paymentMutation = useCreateSupplierPayment()

  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    monto: '',
    metodo: SupplierPaymentMethod.TRANSFERENCIA,
    comprobante: '',
  })

  const handleReceive = () => {
    receiveMutation.mutate(purchaseId, { onSuccess: () => refetch() })
  }

  const handleCancel = () => {
    cancelMutation.mutate(purchaseId, { onSuccess: () => refetch() })
  }

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault()
    paymentMutation.mutate(
      {
        compra_id: purchaseId,
        fecha: paymentForm.fecha,
        monto: Number(paymentForm.monto),
        metodo: paymentForm.metodo,
        comprobante: paymentForm.comprobante || null,
      },
      {
        onSuccess: () => {
          setPaymentOpen(false)
          setPaymentForm({ fecha: new Date().toISOString().slice(0, 10), monto: '', metodo: SupplierPaymentMethod.TRANSFERENCIA, comprobante: '' })
          refetch()
        },
      },
    )
  }

  if (isLoading) {
    return <LoadingSpinner className="py-20" text="Cargando compra..." />
  }

  if (isError || !purchase) {
    return <ErrorMessage message="Error al cargar la compra" onRetry={() => refetch()} />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/compras')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{purchase.concepto}</h1>
            <Badge variant={statusBadgeVariant[purchase.estado] ?? 'default'}>
              {PURCHASE_STATUS_LABELS[purchase.estado as PurchaseStatus] ?? purchase.estado}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Fecha: {formatDate(purchase.fecha)}
          </p>
        </div>
        <div className="flex gap-2">
          {purchase.estado === PurchaseStatus.PENDIENTE && (
            <>
              <Button
                variant="outline"
                loading={receiveMutation.isPending}
                onClick={handleReceive}
              >
                Recibir
              </Button>
              <Button
                variant="destructive"
                loading={cancelMutation.isPending}
                onClick={handleCancel}
              >
                Cancelar
              </Button>
            </>
          )}
          {purchase.saldo_pendiente > 0 && (
            <Button onClick={() => setPaymentOpen(true)}>
              Registrar Pago
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informacion</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <span className="text-muted-foreground">Proveedor</span>
              <p className="font-medium">{purchase.supplier?.razon_social ?? `#${purchase.proveedor_id}`}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Fecha Vto. Pago</span>
              <p className="font-medium">{purchase.fecha_vto_pago ? formatDate(purchase.fecha_vto_pago) : '-'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Monto Total</span>
              <p className="font-medium">{formatCurrency(purchase.monto_total)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Monto Pagado</span>
              <p className="font-medium">{formatCurrency(purchase.monto_pagado)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Saldo Pendiente</span>
              <p className="font-semibold text-destructive">{formatCurrency(purchase.saldo_pendiente)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {purchase.details && purchase.details.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detalles</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Articulo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Costo Unitario</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchase.details.map((detail) => (
                  <TableRow key={detail.id}>
                    <TableCell className="font-medium">{detail.articulo_nombre}</TableCell>
                    <TableCell className="text-right">{detail.cantidad}</TableCell>
                    <TableCell className="text-right">{formatCurrency(detail.costo_unitario)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(detail.subtotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {purchase.payments && purchase.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pagos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Metodo</TableHead>
                  <TableHead>Socio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchase.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(payment.fecha)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(payment.monto)}</TableCell>
                    <TableCell>{payment.metodo}</TableCell>
                    <TableCell>{payment.socio?.nombre ?? `#${payment.socio_id}`}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Modal isOpen={paymentOpen} onClose={() => setPaymentOpen(false)} title="Registrar Pago a Proveedor">
        <form onSubmit={handlePayment} className="space-y-4">
          <Input
            label="Fecha"
            type="date"
            value={paymentForm.fecha}
            onChange={(e) => setPaymentForm((f) => ({ ...f, fecha: e.target.value }))}
            required
          />
          <Input
            label="Monto"
            type="number"
            step="0.01"
            min="0.01"
            max={purchase.saldo_pendiente}
            value={paymentForm.monto}
            onChange={(e) => setPaymentForm((f) => ({ ...f, monto: e.target.value }))}
            required
          />
          <p className="text-sm text-muted-foreground">
            Saldo pendiente: <span className="font-semibold text-destructive">{formatCurrency(purchase.saldo_pendiente)}</span>
          </p>
          <Select
            label="Metodo"
            options={methodOptions}
            value={paymentForm.metodo}
            onChange={(e) => setPaymentForm((f) => ({ ...f, metodo: e.target.value as SupplierPaymentMethod }))}
          />
          <Input
            label="Comprobante"
            value={paymentForm.comprobante}
            onChange={(e) => setPaymentForm((f) => ({ ...f, comprobante: e.target.value }))}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={paymentMutation.isPending}>
              Registrar Pago
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
