import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useArticle, useArticleMovements } from '@/hooks/useArticles'
import { formatDate, formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { ARTICLE_TYPE_LABELS, MOVEMENT_TYPE_LABELS, ArticleType, MovementType } from '@/types/enums'
import type { InventoryMovement } from '@/types/models'

const movementBadgeVariant: Record<string, 'success' | 'error' | 'info'> = {
  ENTRADA: 'success',
  SALIDA: 'error',
  AJUSTE: 'info',
}

function stockIndicator(stock: number, umbral: number) {
  if (stock === 0) return <Badge variant="error">Sin stock</Badge>
  if (stock <= umbral) return <Badge variant="warning">Stock bajo ({stock})</Badge>
  return <Badge variant="success">En stock ({stock})</Badge>
}

export default function ArticleDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const articleId = Number(id)

  const [activeTab, setActiveTab] = useState('info')

  const { data: article, isLoading, isError, refetch } = useArticle(articleId)
  const { data: movementsData } = useArticleMovements(articleId)

  if (isLoading) {
    return <LoadingSpinner className="py-20" text="Cargando articulo..." />
  }

  if (isError || !article) {
    return <ErrorMessage message="Error al cargar el articulo" onRetry={() => refetch()} />
  }

  const infoFields = [
    { label: 'Nombre', value: article.nombre },
    { label: 'Tipo', value: null },
    { label: 'Subtipo', value: article.subtipo ?? '-' },
    { label: 'Marca', value: article.marca ?? '-' },
    { label: 'Modelo / SKU', value: article.modelo_sku ?? '-' },
    { label: 'Stock Actual', value: null },
    { label: 'Umbral Reposicion', value: article.umbral_reposicion.toString() },
    { label: 'Costo Unitario', value: formatCurrency(article.costo_unitario) },
    { label: 'Proveedor', value: article.supplier?.razon_social ?? '-' },
    { label: 'Activo', value: article.activo ? 'Si' : 'No' },
    { label: 'Fecha Creacion', value: formatDate(article.fecha_creacion) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/articulos"
            className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Articulos
          </Link>
          <h1 className="text-2xl font-bold">{article.nombre}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge>{ARTICLE_TYPE_LABELS[article.tipo_articulo as ArticleType] ?? article.tipo_articulo}</Badge>
            {stockIndicator(article.stock_actual, article.umbral_reposicion)}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="info">Informacion</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="impresoras">Impresoras Compatibles</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>Datos del Articulo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {infoFields.map((field) => (
                  <div key={field.label}>
                    <p className="text-sm text-muted-foreground">{field.label}</p>
                    {field.label === 'Tipo' ? (
                      <Badge>{ARTICLE_TYPE_LABELS[article.tipo_articulo as ArticleType] ?? article.tipo_articulo}</Badge>
                    ) : field.label === 'Stock Actual' ? (
                      stockIndicator(article.stock_actual, article.umbral_reposicion)
                    ) : (
                      <p className="font-medium">{field.value}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movimientos">
          <Card>
            <CardHeader>
              <CardTitle>Movimientos de Inventario</CardTitle>
            </CardHeader>
            <CardContent>
              {!movementsData?.data?.length ? (
                <EmptyState title="Sin movimientos" description="No hay movimientos registrados para este articulo" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead>Stock Anterior</TableHead>
                      <TableHead>Stock Posterior</TableHead>
                      <TableHead>Justificacion</TableHead>
                      <TableHead>Socio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movementsData.data.map((mov: InventoryMovement) => (
                      <TableRow key={mov.id}>
                        <TableCell>{formatDate(mov.fecha)}</TableCell>
                        <TableCell>
                          <Badge variant={movementBadgeVariant[mov.tipo_movimiento] ?? 'default'}>
                            {MOVEMENT_TYPE_LABELS[mov.tipo_movimiento as MovementType] ?? mov.tipo_movimiento}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{mov.cantidad}</TableCell>
                        <TableCell>{mov.stock_anterior}</TableCell>
                        <TableCell>{mov.stock_posterior}</TableCell>
                        <TableCell>{mov.justificacion ?? '-'}</TableCell>
                        <TableCell>{mov.socio?.nombre ?? '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="impresoras">
          <Card>
            <CardHeader>
              <CardTitle>Impresoras Compatibles</CardTitle>
            </CardHeader>
            <CardContent>
              {!article.impresoras_compatibles?.length ? (
                <EmptyState title="Sin impresoras" description="No hay impresoras compatibles registradas" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID Impresora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {article.impresoras_compatibles.map((printerId: number) => (
                      <TableRow
                        key={printerId}
                        className="cursor-pointer"
                        onClick={() => navigate(`/impresoras/${printerId}`)}
                      >
                        <TableCell className="font-medium">Impresora #{printerId}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
