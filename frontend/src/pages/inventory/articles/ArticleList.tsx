import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, MoreVertical } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { useArticles, useCreateArticle } from '@/hooks/useArticles'
import { formatCurrency } from '@/lib/formatters'
import { useIsAdmin } from '@/contexts/AuthContext'
import type { Article } from '@/types/article'

const tipoOptions = [
  { value: 'CONSUMIBLE', label: 'Consumible' },
  { value: 'PIEZA_REPUESTO', label: 'Pieza de repuesto' },
]

interface FormErrors {
  nombre?: string
  marca?: string
  modelo?: string
  cantidad_en_stock?: string
  umbral_reposicion?: string
  costo_unitario?: string
}

function ArticleForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: Omit<Article, 'id'>) => void
  onCancel: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<'CONSUMIBLE' | 'PIEZA_REPUESTO'>('CONSUMIBLE')
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [cantidad_en_stock, setCantidadEnStock] = useState('')
  const [umbral_reposicion, setUmbralReposicion] = useState('')
  const [costo_unitario, setCostoUnitario] = useState('')
  const [compatibleCon, setCompatibleCon] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})

  const validate = (): boolean => {
    const newErrors: FormErrors = {}

    if (!nombre.trim()) newErrors.nombre = 'El nombre es obligatorio'
    if (!marca.trim()) newErrors.marca = 'La marca es obligatoria'
    if (!modelo.trim()) newErrors.modelo = 'El modelo es obligatorio'

    const stock = Number(cantidad_en_stock)
    if (!cantidad_en_stock || isNaN(stock) || stock < 0) {
      newErrors.cantidad_en_stock = 'Debe ser un número válido (≥ 0)'
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
      tipo,
      marca: marca.trim(),
      modelo: modelo.trim(),
      cantidad_en_stock: Number(cantidad_en_stock),
      umbral_reposicion: Number(umbral_reposicion),
      costo_unitario: Number(costo_unitario),
      compatible_con: compatibleCon
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
        <Input
          placeholder="Ej: Tóner HP 85A"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          error={!!errors.nombre}
          helperText={errors.nombre}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
        <Select
          options={tipoOptions}
          value={tipo}
          onChange={(v) => setTipo(v as 'CONSUMIBLE' | 'PIEZA_REPUESTO')}
        />
      </div>

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
            placeholder="Ej: 85A"
            value={modelo}
            onChange={(e) => setModelo(e.target.value)}
            error={!!errors.modelo}
            helperText={errors.modelo}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad en Stock</label>
          <Input
            placeholder="0"
            type="number"
            min={0}
            value={cantidad_en_stock}
            onChange={(e) => setCantidadEnStock(e.target.value)}
            error={!!errors.cantidad_en_stock}
            helperText={errors.cantidad_en_stock}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Umbral Reposición</label>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Costo Unitario</label>
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Compatible con</label>
        <textarea
          placeholder="Impresoras compatibles separadas por coma"
          value={compatibleCon}
          onChange={(e) => setCompatibleCon(e.target.value)}
          rows={2}
          className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        />
        <p className="mt-1 text-xs text-gray-500">Separar múltiples modelos con coma</p>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">
          Guardar
        </Button>
      </div>
    </form>
  )
}

export default function ArticleList() {
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const [page, setPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const { data, isLoading, error } = useArticles({ page, per_page: 25 })
  const createMutation = useCreateArticle()

  const articles = data?.data || []

  const getStockStatus = (article: Article) => {
    if (article.cantidad_en_stock === 0) return 'agotado'
    if (article.cantidad_en_stock < article.umbral_reposicion) return 'bajo'
    return 'ok'
  }

  const handleCreate = async (data: Omit<Article, 'id'>) => {
    try {
      await createMutation.mutateAsync(data)
      setShowCreateModal(false)
    } catch (err) {
      console.error('Error creating article:', err)
    }
  }

  const columns = [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
    },
    {
      key: 'nombre',
      label: 'Nombre',
      sortable: true,
      render: (value: string, row: Article) => (
        <div>
          <p className="font-medium">{value}</p>
          <p className="text-xs text-gray-500">{row.marca} {row.modelo}</p>
        </div>
      ),
    },
    {
      key: 'tipo',
      label: 'Tipo',
      sortable: true,
      render: (value: string) => (
        <Badge variant={value === 'CONSUMIBLE' ? 'primary' : 'neutral'}>
          {value === 'CONSUMIBLE' ? 'CONSUMIBLE' : 'PIEZA REPUESTO'}
        </Badge>
      ),
    },
    {
      key: 'cantidad_en_stock',
      label: 'Stock',
      sortable: true,
      render: (value: number, row: Article) => {
        const status = getStockStatus(row)
        return (
          <div>
            <p className={status === 'agotado' ? 'text-red-600 font-semibold' : status === 'bajo' ? 'text-amber-600 font-semibold' : ''}>
              {value} uds
            </p>
            {status !== 'ok' && (
              <p className="text-xs text-red-500">{status === 'agotado' ? 'Agotado' : 'Bajo stock'}</p>
            )}
          </div>
        )
      },
    },
    {
      key: 'umbral_reposicion',
      label: 'Umb. Reposición',
      render: (value: number) => `${value} uds`,
    },
    {
      key: 'costo_unitario',
      label: 'Costo Unitario',
      sortable: true,
      render: (value: number) => formatCurrency(value),
    },
    {
      key: 'acciones',
      label: 'Acciones',
      render: () => (
        <button className="p-1 hover:bg-gray-100 rounded">
          <MoreVertical className="h-4 w-4" />
        </button>
      ),
    },
  ]

  if (isLoading) {
    return (
      <PageLayout title="Inventario › Artículos" showSearch>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Inventario › Artículos" showSearch>
        <div className="flex items-center justify-center h-64">
          <p className="text-red-600">Error al cargar artículos</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Inventario › Artículos" showSearch>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Artículos</h2>
            <p className="text-sm text-gray-500">Gestión de consumibles y piezas de repuesto</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Artículo
            </Button>
          )}
        </div>

        <Table
          data={articles}
          columns={columns}
          searchable={true}
          sortable={true}
          paginatable={true}
          pageSize={25}
          currentPage={page}
          totalPages={data?.last_page || 1}
          onPageChange={setPage}
          emptyMessage="No hay artículos registrados"
          onRowClick={(article) => navigate(`/inventario/articulos/${article.id}`)}
        />
      </div>

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nuevo Artículo"
        size="lg"
      >
        <ArticleForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>
    </PageLayout>
  )
}
