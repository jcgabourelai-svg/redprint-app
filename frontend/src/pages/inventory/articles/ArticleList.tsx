import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Package } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Table from '@/components/ui/Table'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Toast from '@/components/ui/Toast'
import ArticleForm from '@/components/articles/ArticleForm'
import api from '@/lib/api'
import { useCreateArticle } from '@/hooks/useArticles'
import { useServerTable } from '@/hooks/useServerTable'
import { formatCurrency } from '@/lib/formatters'
import { useIsAdmin } from '@/contexts/AuthContext'
import type { Article } from '@/types/article'

export default function ArticleList() {
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [toast, setToast] = useState<{ open: boolean; variant: 'success' | 'error'; message: string }>({
    open: false,
    variant: 'success',
    message: '',
  })
  const { data: articles, tableProps, isLoading, error, hasActiveFilters } = useServerTable<Article>({
    queryKey: ['articles'],
    fetcher: (p) => api.get('/articles', { params: p }).then((r) => r.data),
    defaultSort: { column: 'nombre', dir: 'asc' },
  })
  const createMutation = useCreateArticle()

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
          <p className="text-xs text-muted-foreground">{row.marca} {row.modelo_sku}</p>
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
            <p className={status === 'agotado' ? 'text-destructive font-semibold' : status === 'bajo' ? 'text-warning font-semibold' : ''}>
              {value} uds
            </p>
            {status !== 'ok' && (
              <p className="text-xs text-destructive">{status === 'agotado' ? 'Agotado' : 'Bajo stock'}</p>
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
  ]

  if (isLoading) {
    return (
      <PageLayout title="Inventario › Artículos" showSearch>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Inventario › Artículos" showSearch>
        <div className="flex items-center justify-center h-64">
          <p className="text-destructive">Error al cargar artículos</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Inventario › Artículos" showSearch>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Artículos</h2>
            <p className="text-sm text-muted-foreground">Gestión de consumibles y piezas de repuesto</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Artículo
            </Button>
          )}
        </div>

        {articles.length === 0 && !hasActiveFilters ? (
          <EmptyState
            icon={Package}
            title="No hay artículos"
            description="Comienza creando tu primer artículo para el catálogo de insumos."
            action={
              isAdmin
                ? { label: 'Nuevo Artículo', onClick: () => setShowCreateModal(true) }
                : undefined
            }
          />
        ) : (
          <Table
            data={articles}
            columns={columns}
            searchable={true}
            sortable={true}
            paginatable={true}
            {...tableProps}
            emptyMessage="No se encontraron artículos con los filtros aplicados."
            onRowClick={(article) => navigate(`/inventario/articulos/${article.id}`)}
          />
        )}
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
