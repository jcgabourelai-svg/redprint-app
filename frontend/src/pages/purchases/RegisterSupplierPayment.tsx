import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCreateSupplierPayment } from '@/hooks/useSupplierPayments'
import { usePurchase } from '@/hooks/usePurchases'
import { SupplierPaymentMethod } from '@/types/enums'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { formatCurrency } from '@/lib/utils'

const methodOptions = Object.values(SupplierPaymentMethod).map((m) => ({
  value: m,
  label: m.charAt(0) + m.slice(1).toLowerCase(),
}))

interface RegisterSupplierPaymentProps {
  compraId?: number
  onClose?: () => void
}

export default function RegisterSupplierPayment({ compraId, onClose }: RegisterSupplierPaymentProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const resolvedCompraId = compraId ?? Number(searchParams.get('compra_id')) ?? 0
  const { data: purchase, isLoading: purchaseLoading } = usePurchase(resolvedCompraId)
  const paymentMutation = useCreateSupplierPayment()

  const [form, setForm] = useState({
    compra_id: resolvedCompraId ? String(resolvedCompraId) : '',
    fecha: new Date().toISOString().slice(0, 10),
    monto: '',
    metodo: SupplierPaymentMethod.TRANSFERENCIA,
    comprobante: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    paymentMutation.mutate(
      {
        compra_id: Number(form.compra_id),
        fecha: form.fecha,
        monto: Number(form.monto),
        metodo: form.metodo,
        comprobante: form.comprobante || null,
      },
      {
        onSuccess: () => {
          if (onClose) {
            onClose()
          } else {
            navigate(-1)
          }
        },
      },
    )
  }

  if (resolvedCompraId && purchaseLoading) {
    return <LoadingSpinner text="Cargando compra..." />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {resolvedCompraId && purchase && (
        <div className="rounded-lg border bg-muted/50 p-3 text-sm">
          <span className="text-muted-foreground">Saldo pendiente: </span>
          <span className="font-semibold text-destructive">
            {formatCurrency(purchase.saldo_pendiente)}
          </span>
          <span className="text-muted-foreground"> - {purchase.concepto}</span>
        </div>
      )}

      {!resolvedCompraId && (
        <Input
          label="ID Compra"
          type="number"
          value={form.compra_id}
          onChange={(e) => setForm((f) => ({ ...f, compra_id: e.target.value }))}
          required
        />
      )}

      <Input
        label="Fecha"
        type="date"
        value={form.fecha}
        onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
        required
      />

      <Input
        label="Monto"
        type="number"
        step="0.01"
        min="0.01"
        max={purchase?.saldo_pendiente || undefined}
        value={form.monto}
        onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
        required
      />

      <Select
        label="Metodo"
        options={methodOptions}
        value={form.metodo}
        onChange={(e) => setForm((f) => ({ ...f, metodo: e.target.value as SupplierPaymentMethod }))}
      />

      <Input
        label="Comprobante"
        value={form.comprobante}
        onChange={(e) => setForm((f) => ({ ...f, comprobante: e.target.value }))}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => onClose ? onClose() : navigate(-1)}>
          Cancelar
        </Button>
        <Button type="submit" loading={paymentMutation.isPending}>
          Registrar Pago
        </Button>
      </div>
    </form>
  )
}
