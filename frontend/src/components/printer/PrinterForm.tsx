import { useMemo, useState } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { useWarehouses } from '@/hooks/useWarehouses'

export interface PrinterFormData {
  marca: string
  modelo: string
  num_serie: string
  fecha_adquisicion: string
  almacen_id: string
  costo_adquisicion?: number
  vida_util_meses?: number
  contador_actual?: number
  [key: string]: unknown
}

export interface PrinterInitialData {
  marca?: string
  modelo?: string
  num_serie?: string
  fecha_adquisicion?: string
  almacen_id?: string | number
  warehouse?: { id?: string | number }
  costo_adquisicion?: number
  vida_util_meses?: number
  contador_actual?: number
}

export interface PrinterFormProps {
  initialData?: PrinterInitialData
  onSubmit: (data: PrinterFormData) => void
  onCancel: () => void
  isEdit?: boolean
  loading?: boolean
}

interface FormErrors {
  marca?: string
  modelo?: string
  num_serie?: string
  fecha_adquisicion?: string
  almacen_id?: string
  costo_adquisicion?: string
  vida_util_meses?: string
  contador_actual?: string
}

export default function PrinterForm({
  initialData,
  onSubmit,
  onCancel,
  isEdit = false,
  loading = false,
}: PrinterFormProps) {
  const almacenInicial =
    initialData?.almacen_id != null
      ? String(initialData.almacen_id)
      : initialData?.warehouse?.id != null
        ? String(initialData.warehouse.id)
        : ''
  const [marca, setMarca] = useState(initialData?.marca ?? '')
  const [modelo, setModelo] = useState(initialData?.modelo ?? '')
  const [numSerie, setNumSerie] = useState(initialData?.num_serie ?? '')
  const [fechaAdquisicion, setFechaAdquisicion] = useState(
    initialData?.fecha_adquisicion ? initialData.fecha_adquisicion.slice(0, 10) : ''
  )
  const [almacenId, setAlmacenId] = useState(almacenInicial)
  const [costoAdquisicion, setCostoAdquisicion] = useState(
    initialData?.costo_adquisicion != null ? String(initialData.costo_adquisicion) : ''
  )
  const [vidaUtilMeses, setVidaUtilMeses] = useState(
    initialData?.vida_util_meses != null ? String(initialData.vida_util_meses) : ''
  )
  const [contadorActual, setContadorActual] = useState(
    initialData?.contador_actual != null ? String(initialData.contador_actual) : ''
  )
  const [errors, setErrors] = useState<FormErrors>({})

  const { data: warehousesData } = useWarehouses({ per_page: 100, estado: 'activo' })
  const warehouses = warehousesData?.data || []

  const warehouseOptions = useMemo(
    () =>
      warehouses.map((w) => ({
        value: String(w.id),
        label: w.nombre,
      })),
    [warehouses]
  )

  const validate = (): boolean => {
    const newErrors: FormErrors = {}

    if (!marca.trim()) newErrors.marca = 'La marca es obligatoria'
    if (!modelo.trim()) newErrors.modelo = 'El modelo es obligatorio'
    if (!numSerie.trim()) newErrors.num_serie = 'El número de serie es obligatorio'
    if (!fechaAdquisicion) newErrors.fecha_adquisicion = 'La fecha de adquisición es obligatoria'
    if (!almacenId) newErrors.almacen_id = 'El almacén es obligatorio'

    if (costoAdquisicion) {
      const costo = Number(costoAdquisicion)
      if (isNaN(costo) || costo < 0) {
        newErrors.costo_adquisicion = 'Debe ser un número mayor o igual a 0'
      }
    }

    if (vidaUtilMeses) {
      const vida = Number(vidaUtilMeses)
      if (isNaN(vida) || !Number.isInteger(vida) || vida < 1) {
        newErrors.vida_util_meses = 'Debe ser un número entero mayor a 0'
      }
    }

    if (contadorActual) {
      const contador = Number(contadorActual)
      if (isNaN(contador) || !Number.isInteger(contador) || contador < 0) {
        newErrors.contador_actual = 'Debe ser un número entero mayor o igual a 0'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    onSubmit({
      marca: marca.trim(),
      modelo: modelo.trim(),
      num_serie: numSerie.trim(),
      fecha_adquisicion: fechaAdquisicion,
      almacen_id: almacenId,
      costo_adquisicion: costoAdquisicion ? Number(costoAdquisicion) : undefined,
      vida_util_meses: vidaUtilMeses ? Number(vidaUtilMeses) : undefined,
      contador_actual: contadorActual ? Number(contadorActual) : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
          <Input
            placeholder="Ej: HP"
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            error={!!errors.marca}
            helperText={errors.marca}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
          <Input
            placeholder="Ej: LaserJet Pro M404"
            value={modelo}
            onChange={(e) => setModelo(e.target.value)}
            error={!!errors.modelo}
            helperText={errors.modelo}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Número de serie</label>
        <Input
          placeholder="Ej: VNB3K12345"
          value={numSerie}
          onChange={(e) => setNumSerie(e.target.value)}
          error={!!errors.num_serie}
          helperText={errors.num_serie}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Almacén</label>
        <Select
          options={warehouseOptions}
          value={almacenId}
          onChange={setAlmacenId}
          placeholder="Selecciona un almacén"
          searchable
          error={!!errors.almacen_id}
        />
        {errors.almacen_id && (
          <p className="mt-1 text-xs text-red-600">{errors.almacen_id}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de adquisición</label>
          <Input
            type="date"
            value={fechaAdquisicion}
            onChange={(e) => setFechaAdquisicion(e.target.value)}
            error={!!errors.fecha_adquisicion}
            helperText={errors.fecha_adquisicion}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Costo de adquisición</label>
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="Opcional"
            value={costoAdquisicion}
            onChange={(e) => setCostoAdquisicion(e.target.value)}
            error={!!errors.costo_adquisicion}
            helperText={errors.costo_adquisicion}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Vida útil (meses)</label>
          <Input
            type="number"
            min={1}
            placeholder="Opcional"
            value={vidaUtilMeses}
            onChange={(e) => setVidaUtilMeses(e.target.value)}
            error={!!errors.vida_util_meses}
            helperText={errors.vida_util_meses}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contador inicial</label>
          <Input
            type="number"
            min={0}
            placeholder="Opcional (default 0)"
            value={contadorActual}
            onChange={(e) => setContadorActual(e.target.value)}
            error={!!errors.contador_actual}
            helperText={errors.contador_actual}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading}>
          {isEdit ? 'Guardar Cambios' : 'Crear Impresora'}
        </Button>
      </div>
    </form>
  )
}
