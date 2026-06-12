import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCreatePrinter, useUpdatePrinter } from '@/hooks/usePrinters'
import { useWarehouses } from '@/hooks/useWarehouses'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import type { Printer } from '@/types/models'

const printerSchema = z.object({
  marca: z.string().min(1, 'La marca es requerida'),
  modelo: z.string().min(1, 'El modelo es requerido'),
  num_serie: z.string().min(1, 'El numero de serie es requerido'),
  fecha_adquisicion: z.string().min(1, 'La fecha es requerida'),
  costo_adquisicion: z.string().optional(),
  vida_util_meses: z.string().optional(),
  almacen_id: z.string().optional(),
  contador_actual: z.string().optional(),
})

type PrinterFormData = z.infer<typeof printerSchema>

interface PrinterFormProps {
  isOpen: boolean
  onClose: () => void
  printer?: Printer
}

export default function PrinterForm({ isOpen, onClose, printer }: PrinterFormProps) {
  const { addToast } = useToast()
  const createPrinter = useCreatePrinter()
  const updatePrinter = useUpdatePrinter()
  const { data: warehousesData } = useWarehouses({ per_page: 100 })

  const isEditing = !!printer

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PrinterFormData>({
    resolver: zodResolver(printerSchema),
  })

  useEffect(() => {
    if (printer) {
      reset({
        marca: printer.marca,
        modelo: printer.modelo,
        num_serie: printer.num_serie,
        fecha_adquisicion: printer.fecha_adquisicion,
        costo_adquisicion: printer.costo_adquisicion?.toString() ?? '',
        vida_util_meses: printer.vida_util_meses?.toString() ?? '',
        almacen_id: printer.almacen_id?.toString() ?? '',
        contador_actual: printer.contador_actual.toString(),
      })
    } else {
      reset({
        marca: '',
        modelo: '',
        num_serie: '',
        fecha_adquisicion: '',
        costo_adquisicion: '',
        vida_util_meses: '',
        almacen_id: '',
        contador_actual: '0',
      })
    }
  }, [printer, reset])

  const warehouseOptions = (warehousesData?.data ?? []).map((w) => ({
    value: String(w.id),
    label: w.nombre,
  }))

  const onSubmit = async (data: PrinterFormData) => {
    try {
      const payload: Record<string, unknown> = {
        marca: data.marca,
        modelo: data.modelo,
        num_serie: data.num_serie,
        fecha_adquisicion: data.fecha_adquisicion,
        contador_actual: Number(data.contador_actual) || 0,
      }
      if (data.costo_adquisicion) payload.costo_adquisicion = Number(data.costo_adquisicion)
      if (data.vida_util_meses) payload.vida_util_meses = Number(data.vida_util_meses)
      if (data.almacen_id) payload.almacen_id = Number(data.almacen_id)

      if (isEditing) {
        await updatePrinter.mutateAsync({ id: printer.id, ...payload })
        addToast('Impresora actualizada correctamente', 'success')
      } else {
        await createPrinter.mutateAsync(payload)
        addToast('Impresora creada correctamente', 'success')
      }
      onClose()
    } catch {
      addToast(
        isEditing ? 'Error al actualizar la impresora' : 'Error al crear la impresora',
        'error',
      )
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Impresora' : 'Nueva Impresora'}
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          id="marca"
          label="Marca"
          error={errors.marca?.message}
          {...register('marca')}
        />

        <Input
          id="modelo"
          label="Modelo"
          error={errors.modelo?.message}
          {...register('modelo')}
        />

        <Input
          id="num_serie"
          label="Numero de Serie"
          error={errors.num_serie?.message}
          {...register('num_serie')}
        />

        <Input
          id="fecha_adquisicion"
          label="Fecha de Adquisicion"
          type="date"
          error={errors.fecha_adquisicion?.message}
          {...register('fecha_adquisicion')}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            id="costo_adquisicion"
            label="Costo de Adquisicion"
            type="number"
            step="0.01"
            error={errors.costo_adquisicion?.message}
            {...register('costo_adquisicion')}
          />

          <Input
            id="vida_util_meses"
            label="Vida Util (meses)"
            type="number"
            error={errors.vida_util_meses?.message}
            {...register('vida_util_meses')}
          />
        </div>

        <Select
          id="almacen_id"
          label="Almacen"
          options={warehouseOptions}
          placeholder="Selecciona un almacen"
          error={errors.almacen_id?.message}
          {...register('almacen_id')}
        />

        <Input
          id="contador_actual"
          label="Contador Actual"
          type="number"
          error={errors.contador_actual?.message}
          {...register('contador_actual')}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEditing ? 'Guardar Cambios' : 'Crear Impresora'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
