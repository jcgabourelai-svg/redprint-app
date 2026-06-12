import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCreateInvoice } from '@/hooks/useInvoices'
import { useClients } from '@/hooks/useClients'
import { useContracts } from '@/hooks/useContracts'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useToast } from '@/components/ui/Toast'
import { Trash2, Plus } from 'lucide-react'

const invoiceDetailSchema = z.object({
  contrato_id: z.coerce.number().min(1, 'Selecciona un contrato'),
  impresora_id: z.coerce.number().optional(),
  lectura_id: z.coerce.number().optional(),
  paginas_consumidas: z.coerce.number().min(0),
  monto_calculado: z.coerce.number().min(0),
})

const invoiceSchema = z.object({
  numero_factura: z.string().min(1, 'Numero de factura requerido'),
  cliente_id: z.coerce.number().min(1, 'Selecciona un cliente'),
  contrato_id: z.coerce.number().optional(),
  fecha_emision: z.string().min(1, 'Fecha de emision requerida'),
  fecha_vencimiento: z.string().min(1, 'Fecha de vencimiento requerida'),
  periodo_inicio: z.string().optional(),
  periodo_fin: z.string().optional(),
  monto_total: z.coerce.number().min(0.01, 'El monto debe ser mayor a 0'),
  notas: z.string().optional(),
})

type InvoiceForm = z.infer<typeof invoiceSchema>
type InvoiceDetailForm = z.infer<typeof invoiceDetailSchema>

export default function RegisterInvoicePage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const createInvoice = useCreateInvoice()
  const [details, setDetails] = useState<InvoiceDetailForm[]>([])
  const [showDetails, setShowDetails] = useState(false)

  const { data: clientsData } = useClients({ per_page: 100 })
  const clients = clientsData?.data ?? []

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
  })

  const selectedClientId = watch('cliente_id')

  const { data: contractsData } = useContracts(
    selectedClientId ? { cliente_id: selectedClientId, per_page: 100 } : { per_page: 100 }
  )
  const contracts = contractsData?.data ?? []

  const clientOptions = clients.map((c) => ({
    value: String(c.id),
    label: c.razon_social,
  }))

  const contractOptions = [
    { value: '', label: 'Sin contrato' },
    ...contracts.map((c) => ({
      value: String(c.id),
      label: c.codigo_negocio,
    })),
  ]

  const addDetail = () => {
    setDetails((prev) => [
      ...prev,
      { contrato_id: 0, impresora_id: undefined, lectura_id: undefined, paginas_consumidas: 0, monto_calculado: 0 },
    ])
  }

  const removeDetail = (index: number) => {
    setDetails((prev) => prev.filter((_, i) => i !== index))
  }

  const updateDetail = (index: number, field: keyof InvoiceDetailForm, value: string | number) => {
    setDetails((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: value } : d))
    )
  }

  const onSubmit = async (data: InvoiceForm) => {
    try {
      const payload: Record<string, unknown> = {
        numero_factura: data.numero_factura,
        cliente_id: data.cliente_id,
        fecha_emision: data.fecha_emision,
        fecha_vencimiento: data.fecha_vencimiento,
        monto_total: data.monto_total,
        notas: data.notas || null,
      }
      if (data.contrato_id) payload.contrato_id = data.contrato_id
      if (data.periodo_inicio) payload.periodo_inicio = data.periodo_inicio
      if (data.periodo_fin) payload.periodo_fin = data.periodo_fin
      if (details.length > 0) payload.detalles = details

      await createInvoice.mutateAsync(payload)
      addToast('Factura registrada correctamente', 'success')
      navigate('/facturas')
    } catch {
      addToast('Error al registrar factura', 'error')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Registrar Factura</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Crea una nueva factura
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Datos de Factura</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                id="numero_factura"
                label="Numero de Factura"
                error={errors.numero_factura?.message}
                {...register('numero_factura')}
              />
              <Select
                id="cliente_id"
                label="Cliente"
                options={clientOptions}
                placeholder="Selecciona un cliente"
                error={errors.cliente_id?.message}
                {...register('cliente_id', {
                  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
                    setValue('cliente_id', Number(e.target.value))
                    setValue('contrato_id', undefined as unknown as number)
                  },
                })}
              />
              <Select
                id="contrato_id"
                label="Contrato (opcional)"
                options={contractOptions}
                {...register('contrato_id')}
              />
              <Input
                id="fecha_emision"
                label="Fecha de Emision"
                type="date"
                error={errors.fecha_emision?.message}
                {...register('fecha_emision')}
              />
              <Input
                id="fecha_vencimiento"
                label="Fecha de Vencimiento"
                type="date"
                error={errors.fecha_vencimiento?.message}
                {...register('fecha_vencimiento')}
              />
              <Input
                id="periodo_inicio"
                label="Periodo Inicio (opcional)"
                type="date"
                {...register('periodo_inicio')}
              />
              <Input
                id="periodo_fin"
                label="Periodo Fin (opcional)"
                type="date"
                {...register('periodo_fin')}
              />
              <Input
                id="monto_total"
                label="Monto Total"
                type="number"
                step="0.01"
                min="0"
                error={errors.monto_total?.message}
                {...register('monto_total')}
              />
              <div className="sm:col-span-2">
                <Textarea
                  id="notas"
                  label="Notas (opcional)"
                  {...register('notas')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Detalle de Factura (opcional)</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowDetails(!showDetails)}>
                {showDetails ? 'Ocultar' : 'Agregar Detalle'}
              </Button>
            </div>
          </CardHeader>
          {showDetails && (
            <CardContent>
              <div className="space-y-4">
                {details.map((detail, index) => (
                  <div key={index} className="rounded-md border p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Linea {index + 1}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeDetail(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Select
                        label="Contrato"
                        options={contracts.map((c) => ({ value: String(c.id), label: c.codigo_negocio }))}
                        placeholder="Selecciona"
                        value={detail.contrato_id ? String(detail.contrato_id) : ''}
                        onChange={(e) => updateDetail(index, 'contrato_id', Number(e.target.value))}
                      />
                      <Input
                        label="Impresora ID"
                        type="number"
                        value={detail.impresora_id ?? ''}
                        onChange={(e) => updateDetail(index, 'impresora_id', Number(e.target.value))}
                      />
                      <Input
                        label="Lectura ID"
                        type="number"
                        value={detail.lectura_id ?? ''}
                        onChange={(e) => updateDetail(index, 'lectura_id', Number(e.target.value))}
                      />
                      <Input
                        label="Paginas Consumidas"
                        type="number"
                        min={0}
                        value={detail.paginas_consumidas}
                        onChange={(e) => updateDetail(index, 'paginas_consumidas', Number(e.target.value))}
                      />
                      <Input
                        label="Monto Calculado"
                        type="number"
                        step="0.01"
                        min={0}
                        value={detail.monto_calculado}
                        onChange={(e) => updateDetail(index, 'monto_calculado', Number(e.target.value))}
                      />
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addDetail}>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Linea
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/facturas')}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Registrar Factura
          </Button>
        </div>
      </form>
    </div>
  )
}
