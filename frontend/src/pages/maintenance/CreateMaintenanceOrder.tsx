import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateMaintenanceOrder } from '@/hooks/useMaintenanceOrders'
import { usePrinters } from '@/hooks/usePrinters'
import { useSuppliers } from '@/hooks/useSuppliers'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useToast } from '@/components/ui/Toast'
import type { Printer, Supplier } from '@/types/models'
import { MaintenanceType, MAINTENANCE_TYPE_LABELS } from '@/types/enums'

const typeOptions = Object.values(MaintenanceType).map((t) => ({
  value: t,
  label: MAINTENANCE_TYPE_LABELS[t],
}))

export default function CreateMaintenanceOrder() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const createMutation = useCreateMaintenanceOrder()

  const [impresoraId, setImpresoraId] = useState('')
  const [tipoMantto, setTipoMantto] = useState('')
  const [fecha, setFecha] = useState('')
  const [descProblema, setDescProblema] = useState('')
  const [proveedorId, setProveedorId] = useState('')
  const [costoManoObra, setCostoManoObra] = useState('')

  const { data: printersData } = usePrinters({ page: 1, per_page: 100 })
  const { data: suppliersData } = useSuppliers({ page: 1, per_page: 100 })

  const printerOptions = printersData?.data.map((p: Printer) => ({
    value: String(p.id),
    label: `${p.codigo_negocio} - ${p.marca} ${p.modelo}`,
  })) ?? []

  const supplierOptions = [
    { value: '', label: 'Sin proveedor' },
    ...(suppliersData?.data.map((s: Supplier) => ({
      value: String(s.id),
      label: s.razon_social,
    })) ?? []),
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const data: Record<string, unknown> = {
        impresora_id: Number(impresoraId),
        tipo_mantto: tipoMantto,
        fecha,
        desc_problema: descProblema || null,
        costo_mano_obra: Number(costoManoObra) || 0,
      }
      if (proveedorId) data.proveedor_id = Number(proveedorId)

      const result = await createMutation.mutateAsync(data)
      addToast('Orden creada', 'success')
      navigate(`/mantenimiento/${result.id}`)
    } catch {
      addToast('Error al crear la orden', 'error')
    }
  }

  if (!printersData) {
    return <LoadingSpinner className="py-20" text="Cargando..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nueva Orden de Mantenimiento</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
        <Select
          label="Impresora"
          options={printerOptions}
          value={impresoraId}
          onChange={(e) => setImpresoraId(e.target.value)}
          placeholder="Selecciona una impresora"
        />
        <Select
          label="Tipo de Mantenimiento"
          options={typeOptions}
          value={tipoMantto}
          onChange={(e) => setTipoMantto(e.target.value)}
          placeholder="Selecciona el tipo"
        />
        <Input
          label="Fecha"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
        <div className="space-y-1">
          <label className="text-sm font-medium leading-none text-foreground">
            Descripcion del Problema
          </label>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={descProblema}
            onChange={(e) => setDescProblema(e.target.value)}
          />
        </div>
        <Select
          label="Proveedor"
          options={supplierOptions}
          value={proveedorId}
          onChange={(e) => setProveedorId(e.target.value)}
        />
        <Input
          label="Costo Mano de Obra"
          type="number"
          min="0"
          step="0.01"
          value={costoManoObra}
          onChange={(e) => setCostoManoObra(e.target.value)}
        />
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={createMutation.isPending}
            disabled={!impresoraId || !tipoMantto || !fecha}
          >
            Crear Orden
          </Button>
        </div>
      </form>
    </div>
  )
}
