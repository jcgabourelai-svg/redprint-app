import { useState } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'

import type { Warehouse, WarehouseFormData } from '@/types/warehouse'

export interface WarehouseFormProps {
  initialData?: Partial<Warehouse>
  onSubmit: (data: WarehouseFormData) => void
  onCancel: () => void
  isEdit?: boolean
  loading?: boolean
}

interface FormErrors {
  nombre?: string
  direccion?: string
}

export default function WarehouseForm({
  initialData,
  onSubmit,
  onCancel,
  isEdit = false,
  loading = false,
}: WarehouseFormProps) {
  const [nombre, setNombre] = useState(initialData?.nombre ?? '')
  const [direccion, setDireccion] = useState(initialData?.direccion ?? '')
  const [activo, setActivo] = useState<string>(
    initialData?.activo === false ? 'inactivo' : 'activo'
  )
  const [errors, setErrors] = useState<FormErrors>({})

  const validate = (): boolean => {
    const newErrors: FormErrors = {}

    if (!nombre.trim()) newErrors.nombre = 'El nombre es obligatorio'
    if (!direccion.trim()) newErrors.direccion = 'La dirección es obligatoria'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    onSubmit({
      nombre: nombre.trim(),
      direccion: direccion.trim(),
      activo: activo === 'activo',
    })
  }

  const estadoOptions = [
    { value: 'activo', label: 'Activo' },
    { value: 'inactivo', label: 'Inactivo' },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">Nombre</label>
        <Input
          placeholder="Ej: Almacén Centro"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          error={!!errors.nombre}
          helperText={errors.nombre}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">Dirección</label>
        <Input
          placeholder="Ej: Av. Insurgentes Sur 1250, CDMX"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          error={!!errors.direccion}
          helperText={errors.direccion}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">Estado</label>
        <Select
          options={estadoOptions}
          value={activo}
          onChange={(v) => setActivo(v as string)}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading}>
          {isEdit ? 'Guardar Cambios' : 'Crear Almacén'}
        </Button>
      </div>
    </form>
  )
}
