import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { useArticles } from '@/hooks/useArticles'
import { useAuth } from '@/hooks/useAuth'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/EmptyState'
import { TablePagination } from '@/components/ui/TablePagination'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { ARTICLE_TYPE_LABELS, ArticleType } from '@/types/enums'
import { formatCurrency } from '@/lib/utils'
import type { Article } from '@/types/models'
import ArticleForm from './ArticleForm'

const typeOptions = [
  { value: '', label: 'Todos los tipos' },
  ...Object.values(ArticleType).map((t) => ({
    value: t,
    label: ARTICLE_TYPE_LABELS[t],
  })),
]

function stockBadge(stock: number, umbral: number) {
  if (stock === 0) return <Badge variant="error">0</Badge>
  if (stock <= umbral) return <Badge variant="warning">{stock}</Badge>
  return <Badge variant="success">{stock}</Badge>
}

export default function ArticleList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.rol === 'ADMIN'

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [tipo, setTipo] = useState('')
  const [stockBajo, setStockBajo] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingArticle, setEditingArticle] = useState<Article | undefined>(undefined)

  const params: Record<string, string | number> = { page }
  if (search) params.search = search
  if (tipo) params.tipo_articulo = tipo
  if (stockBajo) params.stock_bajo = 'true'

  const { data, isLoading, isError, refetch } = useArticles(params)

  const handleRowClick = (id: number) => {
    navigate(`/articulos/${id}`)
  }

  const handleNewArticle = () => {
    setEditingArticle(undefined)
    setFormOpen(true)
  }

  if (isLoading) {
    return <LoadingSpinner className="py-20" text="Cargando articulos..." />
  }

  if (isError) {
    return <ErrorMessage message="Error al cargar los articulos" onRetry={() => refetch()} />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Articulos</h1>
        {isAdmin && (
          <Button onClick={handleNewArticle}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Articulo
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, marca..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <Select
          options={typeOptions}
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value)
            setPage(1)
          }}
          className="w-full sm:w-48"
        />
        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
          <input
            type="checkbox"
            checked={stockBajo}
            onChange={(e) => {
              setStockBajo(e.target.checked)
              setPage(1)
            }}
            className="rounded border-input"
          />
          Stock bajo
        </label>
      </div>

      {!data?.data.length ? (
        <EmptyState title="Sin articulos" description="No se encontraron articulos con los filtros seleccionados" />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Subtipo</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead className="text-center">Stock</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-center">Activo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((article: Article) => (
                <TableRow
                  key={article.id}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(article.id)}
                >
                  <TableCell className="font-medium">{article.nombre}</TableCell>
                  <TableCell>{ARTICLE_TYPE_LABELS[article.tipo_articulo as ArticleType] ?? article.tipo_articulo}</TableCell>
                  <TableCell>{article.subtipo ?? '-'}</TableCell>
                  <TableCell>{article.marca ?? '-'}</TableCell>
                  <TableCell className="text-center">{stockBadge(article.stock_actual, article.umbral_reposicion)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(article.costo_unitario)}</TableCell>
                  <TableCell>{article.supplier?.razon_social ?? '-'}</TableCell>
                  <TableCell className="text-center">
                    {article.activo ? (
                      <Badge variant="success">Si</Badge>
                    ) : (
                      <Badge variant="error">No</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <TablePagination
            currentPage={data.current_page}
            totalPages={data.last_page}
            onPageChange={setPage}
          />
        </>
      )}

      <ArticleForm
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        article={editingArticle}
      />
    </div>
  )
}
