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
import Toast from '@/components/ui/Toast'
import { useArticles, useCreateArticle } from '@/hooks/useArticles'
import { formatCurrency } from '@/lib/formatters'
import { useIsAdmin } from '@/contexts/AuthContext'
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

function ArticleForm({
  onSubmit,
  onCancel,
  submitting,
}: {
  onSubmit: (data: Omit<Article, 'id'>) => void
  onCancel: () => void
  submitting?: boolean
}) {
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<'CONSUMIBLE' | 'REPARACION'>('CONSUMIBLE')
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [stock_actual, setStockActual] = useState('')
  const [umbral_reposicion, setUmbralReposicion] = useState('')
  const [costo_unitario, setCostoUnitario] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})

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
          onChange={(v) => setTipo(v as 'CONSUMIBLE' | 'REPARACION')}
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
            error={!!errors.modelo_sku}
            helperText={errors.modelo_sku}
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
            value={stock_actual}
            onChange={(e) => setStockActual(e.target.value)}
            error={!!errors.stock_actual}
            helperText={errors.stock_actual}
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

export default function ArticleList() {
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const [page, setPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [toast, setToast] = useState<{ open: boolean; variant: 'success' | 'error'; message: string }>({
    open: false,
    variant: 'success',
    message: '',
  })
  const { data, isLoading, error } = useArticles({ page, per_page: 25 })
  const createMutation = useCreateArticle()

  const articles = data?.data || []

  const getStockStatus = (article: Article) => {
    if (article.stock_actual === 0) return 'agotado'
    if (article.stock_actual < article.umbral_reposicion) return 'bajo'
    return 'ok'
  }

  const handleCreate = async (data: Omit<Article, 'id'>) => {
    try {
      await createMutation.mutateAsync(data)
      setShowCreateModal(false)
      setToast({ open: true, variant: 'success', message: 'Artículo creado correctamente' })
    } catch (err: any) {
      console.error('Error creating article:', err)
      const backendMessage = err?.response?.data?.message
      setToast({
        open: true,
        variant: 'error',
        message: backendMessage || 'No se pudo crear el artículo. Verifica los datos.',
      })
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
          <p className="text-xs text-gray-500">{row.marca} {row.modelo_sku}</p>
        </div>
      ),
    },
    {
      key: 'tipo_articulo',
      label: 'Tipo',
      sortable: true,
      render: (value: string) => (
        <Badge variant={value === 'CONSUMIBLE' ? 'primary' : 'neutral'}>
          {value === 'CONSUMIBLE' ? 'CONSUMIBLE' : 'PIEZA REPUESTO'}
        </Badge>
      ),
    },
    {
      key: 'stock_actual',
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
          totalPages={data?.last_page ?? 1}
          totalItems={data?.total ?? articles.length}
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
          submitting={createMutation.isPending}
        />
      </Modal>

      <Toast
        isOpen={toast.open}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        variant={toast.variant}
        message={toast.message}
      />
    </PageLayout>
  )
}
