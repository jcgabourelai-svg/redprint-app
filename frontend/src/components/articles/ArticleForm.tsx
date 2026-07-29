import { useMemo, useState } from 'react'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import MultiSelect from '@/components/ui/MultiSelect'
import Button from '@/components/ui/Button'
import { usePrinterBrands, buildPrinterModelOptions } from '@/hooks/usePrinterCatalog'
import type { Article } from '@/types/article'

const tipoOptions = [
  { value: 'CONSUMIBLE', label: 'Consumible' },
  { value: 'REPARACION', label: 'Pieza de repuesto' },
]

interface FormErrors {
  nombre?: string
  marca?: string
  modelo_sku?: string
  stock_actual?: string
  umbral_reposicion?: string
  costo_unitario?: string
}

interface ArticleFormProps {
  onSubmit: (data: Omit<Article, 'id'>) => void
  onCancel: () => void
  submitting?: boolean
  initialData?: Partial<Article>
}

export default function ArticleForm({ onSubmit, onCancel, submitting, initialData }: ArticleFormProps) {
  const [nombre, setNombre] = useState(initialData?.nombre ?? '')
  const [tipo, setTipo] = useState<'CONSUMIBLE' | 'REPARACION'>(
    (initialData?.tipo_articulo as 'CONSUMIBLE' | 'REPARACION') ?? 'CONSUMIBLE'
  )
  const [marca, setMarca] = useState(initialData?.marca ?? '')
  const [modelo, setModelo] = useState(initialData?.modelo_sku ?? '')
  const [stock_actual, setStockActual] = useState(initialData?.stock_actual?.toString() ?? '')
  const [umbral_reposicion, setUmbralReposicion] = useState(initialData?.umbral_reposicion?.toString() ?? '')
  const [costo_unitario, setCostoUnitario] = useState(initialData?.costo_unitario?.toString() ?? '')
  const [modelosCompatibles, setModelosCompatibles] = useState<string[]>(
    (initialData?.modelos_compatibles ?? []).map((m) => String(m.id))
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const { data: brands } = usePrinterBrands(true)

  const modelOptions = useMemo(() => buildPrinterModelOptions(brands), [brands])

  const validate = (): boolean => {
    const newErrors: FormErrors = {}

    if (!nombre.trim()) newErrors.nombre = 'El nombre es obligatorio'
    if (!marca.trim()) newErrors.marca = 'La marca es obligatoria'
    if (!modelo.trim()) newErrors.modelo_sku = 'El modelo es obligatorio'

    const stock = Number(stock_actual)
    if (!stock_actual || isNaN(stock) || stock < 0) {
      newErrors.stock_actual = 'Debe ser un número válido (≥ 0)'
    }

    const umbral = Number(umbral_reposicion)
    if (!umbral_reposicion || isNaN(umbral) || umbral < 0) {
      newErrors.umbral_reposicion = 'Debe ser un número válido (≥ 0)'
    }

    const costo = Number(costo_unitario)
    if (!costo_unitario || isNaN(costo) || costo < 0) {
      newErrors.costo_unitario = 'Debe ser un número válido (≥ 0)'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    onSubmit({
      nombre: nombre.trim(),
      tipo_articulo: tipo,
      marca: marca.trim(),
      modelo_sku: modelo.trim(),
      stock_actual: Number(stock_actual),
      umbral_reposicion: Number(umbral_reposicion),
      costo_unitario: Number(costo_unitario),
      modelos_compatibles: modelosCompatibles.map((v) => Number(v)),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">Nombre</label>
        <Input
          placeholder="Ej: Tóner HP 85A"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          error={!!errors.nombre}
          helperText={errors.nombre}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">Tipo</label>
        <Select
          options={tipoOptions}
          value={tipo}
          onChange={(v) => setTipo(v as 'CONSUMIBLE' | 'REPARACION')}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Marca</label>
          <Input
            placeholder="Ej: HP"
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            error={!!errors.marca}
            helperText={errors.marca}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Modelo</label>
          <Input
            placeholder="Ej: 85A"
            value={modelo}
            onChange={(e) => setModelo(e.target.value)}
            error={!!errors.modelo_sku}
            helperText={errors.modelo_sku}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Cantidad en Stock</label>
          <Input
            placeholder="0"
            type="number"
            min={0}
            value={stock_actual}
            onChange={(e) => setStockActual(e.target.value)}
            error={!!errors.stock_actual}
            helperText={errors.stock_actual}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Umbral Reposición</label>
          <Input
            placeholder="0"
            type="number"
            min={0}
            value={umbral_reposicion}
            onChange={(e) => setUmbralReposicion(e.target.value)}
            error={!!errors.umbral_reposicion}
            helperText={errors.umbral_reposicion}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Costo Unitario</label>
          <Input
            placeholder="0.00"
            type="number"
            min={0}
            step={0.01}
            value={costo_unitario}
            onChange={(e) => setCostoUnitario(e.target.value)}
            error={!!errors.costo_unitario}
            helperText={errors.costo_unitario}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">
          Modelos compatibles <span className="text-muted-foreground">(opcional)</span>
        </label>
        <MultiSelect
          options={modelOptions}
          value={modelosCompatibles}
          onChange={setModelosCompatibles}
          searchable
          placeholder="Selecciona los modelos de impresora compatibles..."
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Indica en qué modelos de impresora se puede usar este artículo.
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={submitting}>
          Guardar
        </Button>
      </div>
    </form>
  )
}
