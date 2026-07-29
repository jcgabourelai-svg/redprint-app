import { useMemo, useState } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { useWarehouses } from '@/hooks/useWarehouses'
import { usePrinterBrands, useCreatePrinterBrand, useCreatePrinterModel } from '@/hooks/usePrinterCatalog'
import { useIsAdmin } from '@/contexts/AuthContext'

export interface PrinterFormData {
  printer_model_id: number
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
  printer_model_id?: number
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
  printer_model_id?: string
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
  const isAdmin = useIsAdmin()
  const almacenInicial =
    initialData?.almacen_id != null
      ? String(initialData.almacen_id)
      : initialData?.warehouse?.id != null
        ? String(initialData.warehouse.id)
        : ''

  const [brandId, setBrandId] = useState<string>(initialData?.printer_model_id ? '' : '')
  const [printerModelId, setPrinterModelId] = useState<string>(
    initialData?.printer_model_id ? String(initialData.printer_model_id) : ''
  )
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
  const { data: brands, isLoading: loadingBrands } = usePrinterBrands(true)
  const brandsList = brands ?? []

  // Resolver brand_id inicial desde el modelo seleccionado (caso edición)
  const initialModel = useMemo(
    () =>
      initialData?.printer_model_id
        ? brandsList
            .flatMap((b) => b.modelos ?? [])
            .find((m) => m.id === initialData.printer_model_id)
        : undefined,
    [brandsList, initialData?.printer_model_id]
  )

  const resolvedBrandId = brandId || (initialModel ? String(initialModel.brand_id) : '')

  const createBrand = useCreatePrinterBrand()
  const createModel = useCreatePrinterModel()

  const warehouseOptions = useMemo(
    () =>
      warehouses.map((w) => ({
        value: String(w.id),
        label: w.nombre,
      })),
    [warehouses]
  )

  const brandOptions = useMemo(
    () =>
      brandsList.map((b) => ({
        value: String(b.id),
        label: b.nombre,
      })),
    [brandsList]
  )

  const modelOptions = useMemo(() => {
    const brand = brandsList.find((b) => String(b.id) === resolvedBrandId)
    return (brand?.modelos ?? []).map((m) => ({
      value: String(m.id),
      label: m.nombre,
    }))
  }, [brandsList, resolvedBrandId])

  const handleBrandChange = (newBrandId: string) => {
    setBrandId(newBrandId)
    // Al cambiar de marca, se limpia siempre el modelo; el usuario vuelve a elegir.
    setPrinterModelId('')
  }

  const handleCreateBrand = async (nombre: string) => {
    const brand = await createBrand.mutateAsync({ nombre })
    setBrandId(String(brand.id))
    setPrinterModelId('')
    return brand.id
  }

  const handleCreateModel = async (nombre: string) => {
    if (!resolvedBrandId) return null
    const model = await createModel.mutateAsync({
      brand_id: Number(resolvedBrandId),
      nombre,
    })
    setPrinterModelId(String(model.id))
    return model.id
  }

  const validate = (): boolean => {
    const newErrors: FormErrors = {}

    if (!printerModelId) newErrors.printer_model_id = 'Selecciona un modelo de impresora'
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
      printer_model_id: Number(printerModelId),
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
          <label className="block text-sm font-medium text-muted-foreground mb-1">Marca</label>
          <CreatableSelect
            options={brandOptions}
            value={resolvedBrandId}
            onChange={handleBrandChange}
            onCreate={handleCreateBrand}
            canCreate={isAdmin}
            placeholder="Selecciona o crea una marca"
            searchPlaceholder="Buscar marca..."
            loading={loadingBrands}
            error={!!errors.printer_model_id && !resolvedBrandId}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Modelo</label>
          <CreatableSelect
            options={modelOptions}
            value={printerModelId}
            onChange={setPrinterModelId}
            onCreate={handleCreateModel}
            canCreate={isAdmin && !!resolvedBrandId}
            placeholder={resolvedBrandId ? 'Selecciona o crea un modelo' : 'Primero elige una marca'}
            searchPlaceholder="Buscar modelo..."
            loading={loadingBrands}
            disabled={!resolvedBrandId}
            error={!!errors.printer_model_id}
          />
          {errors.printer_model_id && (
            <p className="mt-1 text-xs text-destructive">{errors.printer_model_id}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">Número de serie</label>
        <Input
          placeholder="Ej: VNB3K12345"
          value={numSerie}
          onChange={(e) => setNumSerie(e.target.value)}
          error={!!errors.num_serie}
          helperText={errors.num_serie}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">Almacén</label>
        <Select
          options={warehouseOptions}
          value={almacenId}
          onChange={setAlmacenId}
          placeholder="Selecciona un almacén"
          searchable
          error={!!errors.almacen_id}
        />
        {errors.almacen_id && (
          <p className="mt-1 text-xs text-destructive">{errors.almacen_id}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Fecha de adquisición</label>
          <Input
            type="date"
            value={fechaAdquisicion}
            onChange={(e) => setFechaAdquisicion(e.target.value)}
            error={!!errors.fecha_adquisicion}
            helperText={errors.fecha_adquisicion}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Costo de adquisición</label>
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
          <label className="block text-sm font-medium text-muted-foreground mb-1">Vida útil (meses)</label>
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
          <label className="block text-sm font-medium text-muted-foreground mb-1">Contador inicial</label>
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
