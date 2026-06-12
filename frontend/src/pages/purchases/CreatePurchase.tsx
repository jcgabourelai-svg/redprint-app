import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { useCreatePurchase } from '@/hooks/usePurchases'
import { useSuppliers } from '@/hooks/useSuppliers'
import { useArticles } from '@/hooks/useArticles'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { formatCurrency } from '@/lib/utils'

interface DetailLine {
  articulo_id: string
  articulo_nombre: string
  cantidad: string
  costo_unitario: string
}

const emptyLine = (): DetailLine => ({
  articulo_id: '',
  articulo_nombre: '',
  cantidad: '',
  costo_unitario: '',
})

export default function CreatePurchase() {
  const navigate = useNavigate()
  const createMutation = useCreatePurchase()

  const { data: suppliersData } = useSuppliers({ page: 1, per_page: 100 })
  const { data: articlesData } = useArticles({ page: 1, per_page: 200 })

  const supplierOptions = suppliersData?.data.map((s) => ({
    value: String(s.id),
    label: s.razon_social,
  })) ?? []

  const articleOptions = articlesData?.data.map((a) => ({
    value: String(a.id),
    label: a.nombre,
  })) ?? []

  const [form, setForm] = useState({
    proveedor_id: '',
    fecha: new Date().toISOString().slice(0, 10),
    fecha_vto_pago: '',
    concepto: '',
  })

  const [lines, setLines] = useState<DetailLine[]>([emptyLine()])

  const updateLine = (index: number, field: keyof DetailLine, value: string) => {
    setLines((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      if (field === 'articulo_id') {
        const article = articlesData?.data.find((a) => String(a.id) === value)
        if (article) {
          next[index].articulo_nombre = article.nombre
          next[index].costo_unitario = String(article.costo_unitario)
        }
      }
      return next
    })
  }

  const addLine = () => setLines((prev) => [...prev, emptyLine()])

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  const getSubtotal = (line: DetailLine) => {
    const qty = Number(line.cantidad) || 0
    const cost = Number(line.costo_unitario) || 0
    return qty * cost
  }

  const total = lines.reduce((sum, line) => sum + getSubtotal(line), 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const details = lines
      .filter((l) => l.articulo_nombre && Number(l.cantidad) > 0)
      .map((l) => ({
        articulo_id: l.articulo_id ? Number(l.articulo_id) : null,
        articulo_nombre: l.articulo_nombre,
        cantidad: Number(l.cantidad),
        costo_unitario: Number(l.costo_unitario),
      }))

    createMutation.mutate(
      {
        proveedor_id: Number(form.proveedor_id),
        fecha: form.fecha,
        fecha_vto_pago: form.fecha_vto_pago || null,
        concepto: form.concepto,
        details,
      },
      {
        onSuccess: () => navigate('/compras'),
      },
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nueva Compra</h1>
        <Button variant="outline" onClick={() => navigate('/compras')}>
          Cancelar
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Proveedor"
            options={supplierOptions}
            placeholder="Seleccionar proveedor"
            value={form.proveedor_id}
            onChange={(e) => setForm((f) => ({ ...f, proveedor_id: e.target.value }))}
            required
          />
          <Input
            label="Fecha"
            type="date"
            value={form.fecha}
            onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
            required
          />
          <Input
            label="Fecha Vto. Pago"
            type="date"
            value={form.fecha_vto_pago}
            onChange={(e) => setForm((f) => ({ ...f, fecha_vto_pago: e.target.value }))}
          />
          <Input
            label="Concepto"
            value={form.concepto}
            onChange={(e) => setForm((f) => ({ ...f, concepto: e.target.value }))}
            required
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Detalles</h2>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar linea
            </Button>
          </div>

          <div className="space-y-3">
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-3">
                  <Select
                    label="Articulo"
                    options={articleOptions}
                    placeholder="Seleccionar"
                    value={line.articulo_id}
                    onChange={(e) => updateLine(index, 'articulo_id', e.target.value)}
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    label="Nombre"
                    value={line.articulo_nombre}
                    onChange={(e) => updateLine(index, 'articulo_nombre', e.target.value)}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    label="Cantidad"
                    type="number"
                    min="1"
                    value={line.cantidad}
                    onChange={(e) => updateLine(index, 'cantidad', e.target.value)}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    label="Costo Unit."
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.costo_unitario}
                    onChange={(e) => updateLine(index, 'costo_unitario', e.target.value)}
                    required
                  />
                </div>
                <div className="col-span-1 text-sm text-right pt-6">
                  {formatCurrency(getSubtotal(line))}
                </div>
                <div className="col-span-1 pt-6">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLine(index)}
                    disabled={lines.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end border-t pt-4">
            <div className="text-lg font-semibold">
              Total: {formatCurrency(total)}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/compras')}>
            Cancelar
          </Button>
          <Button type="submit" loading={createMutation.isPending}>
            Crear Compra
          </Button>
        </div>
      </form>
    </div>
  )
}
