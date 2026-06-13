import { useState } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'

import type { Warehouse } from '@/types/warehouse'

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
  encargado?: string
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
  const [encargado, setEncargado] = useState(initialData?.encargado ?? '')
  const [telefono, setTelefono] = useState(initialData?.telefono ?? '')
  const [estado, setEstado] = useState<string>(initialData?.estado ?? 'activo')
  const [notas, setNotas] = useState(initialData?.notas ?? '')
  const [errors, setErrors] = useState<FormErrors>({})

  const validate = (): boolean => {
    const newErrors: FormErrors = {}

    if (!nombre.trim()) newErrors.nombre = 'El nombre es obligatorio'
    if (!direccion.trim()) newErrors.direccion = 'La dirección es obligatoria'
    if (!encargado.trim()) newErrors.encargado = 'El encargado es obligatorio'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    onSubmit({
      nombre: nombre.trim(),
      direccion: direccion.trim(),
      encargado: encargado.trim(),
      telefono: telefono.trim() || undefined,
      estado,
      notas: notas.trim() || undefined,
    })
  }

  const estadoOptions = [
    { value: 'activo', label: 'Activo' },
    { value: 'inactivo', label: 'Inactivo' },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
        <Input
          placeholder="Ej: Almacén Centro"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          error={!!errors.nombre}
          helperText={errors.nombre}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
        <Input
          placeholder="Ej: Av. Insurgentes Sur 1250, CDMX"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          error={!!errors.direccion}
          helperText={errors.direccion}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Encargado</label>
          <Input
            placeholder="Nombre del responsable"
            value={encargado}
            onChange={(e) => setEncargado(e.target.value)}
            error={!!errors.encargado}
            helperText={errors.encargado}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
          <Input
            placeholder="Opcional"
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
        <Select
          options={estadoOptions}
          value={estado}
          onChange={(v) => setEstado(v as string)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
        <textarea
          placeholder="Observaciones (opcional)"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
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
