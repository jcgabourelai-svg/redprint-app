import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useInvoice } from '@/hooks/useInvoices'
import { useCreatePayment } from '@/hooks/usePayments'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/utils'
import { PaymentMethod } from '@/types/enums'

const paymentMethodLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.EFECTIVO]: 'Efectivo',
  [PaymentMethod.TRANSFERENCIA]: 'Transferencia',
  [PaymentMethod.DEPOSITO]: 'Deposito',
}

const paymentSchema = z.object({
  monto: z.coerce.number().min(0.01, 'El monto debe ser mayor a 0'),
  metodo_pago: z.string().min(1, 'Selecciona un metodo de pago'),
  fecha: z.string().min(1, 'La fecha es requerida'),
  nota: z.string().optional(),
})

type PaymentForm = z.infer<typeof paymentSchema>

interface RegisterPaymentPageProps {
  invoiceId: number
  onClose: () => void
}

export default function RegisterPaymentPage({ invoiceId, onClose }: RegisterPaymentPageProps) {
  const { addToast } = useToast()
  const { data: invoice, isLoading } = useInvoice(invoiceId)
  const createPayment = useCreatePayment()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PaymentForm>({
    resolver: zodResolver(
      paymentSchema.refine(
        (data) => !invoice || data.monto <= invoice.saldo_pendiente,
        { message: `El monto no puede exceder ${invoice ? formatCurrency(invoice.saldo_pendiente) : 'el saldo pendiente'}`, path: ['monto'] }
      )
    ),
    defaultValues: { fecha: new Date().toISOString().split('T')[0] },
  })

  const methodOptions = Object.values(PaymentMethod).map((m) => ({
    value: m,
    label: paymentMethodLabels[m],
  }))

  const onSubmit = async (data: PaymentForm) => {
    try {
      await createPayment.mutateAsync({
        factura_id: invoiceId,
        monto: data.monto,
        metodo_pago: data.metodo_pago,
        fecha: data.fecha,
        nota: data.nota || null,
      })
      addToast('Pago registrado correctamente', 'success')
      onClose()
    } catch {
      addToast('Error al registrar pago', 'error')
    }
  }

  if (isLoading) return <LoadingSpinner text="Cargando factura..." />

  return (
    <div className="space-y-4">
      {invoice && (
        <div className="rounded-md bg-muted p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Factura:</span>
            <span className="font-medium">{invoice.numero_factura}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Monto Total:</span>
            <span className="font-medium">{formatCurrency(invoice.monto_total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Monto Pagado:</span>
            <span className="font-medium">{formatCurrency(invoice.monto_pagado)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Saldo Pendiente:</span>
            <span className="font-semibold text-destructive">{formatCurrency(invoice.saldo_pendiente)}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          id="monto"
          label="Monto"
          type="number"
          step="0.01"
          min="0.01"
          max={invoice?.saldo_pendiente}
          error={errors.monto?.message}
          {...register('monto')}
        />
        <Select
          id="metodo_pago"
          label="Metodo de Pago"
          options={methodOptions}
          placeholder="Selecciona un metodo"
          error={errors.metodo_pago?.message}
          {...register('metodo_pago')}
        />
        <Input
          id="fecha"
          label="Fecha"
          type="date"
          error={errors.fecha?.message}
          {...register('fecha')}
        />
        <Textarea
          id="nota"
          label="Nota (opcional)"
          {...register('nota')}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Registrar Pago
          </Button>
        </div>
      </form>
    </div>
  )
}
