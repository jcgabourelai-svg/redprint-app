import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Package, AlertTriangle, DollarSign, BoxIcon, Link2, Edit } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Tabs from '@/components/ui/Tabs'
import { useArticle } from '@/hooks/useArticles'
import { useIsAdmin } from '@/contexts/AuthContext'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { Article } from '@/types/article'

export default function ArticleDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const articleId = id ? parseInt(id) : 0
  const { data: article, isLoading, error } = useArticle(articleId)

  if (isLoading) {
    return (
      <PageLayout title="Inventario › Artículos">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </PageLayout>
    )
  }

  if (error || !article) {
    return (
      <PageLayout title="Inventario › Artículos">
        <div className="flex items-center justify-center h-64">
          <p className="text-red-600">Artículo no encontrado</p>
        </div>
      </PageLayout>
    )
  }

  const getStockColor = () => {
    if (article.cantidad_en_stock === 0) return 'text-red-600'
    if (article.cantidad_en_stock < article.umbral_reposicion) return 'text-amber-600'
    return 'text-green-600'
  }

  const getStockLabel = () => {
    if (article.cantidad_en_stock === 0) return 'Agotado'
    if (article.cantidad_en_stock < article.umbral_reposicion) return 'Bajo stock'
    return 'Stock suficiente'
  }

  return (
    <PageLayout title={`Inventario › Artículos › ${article.nombre}`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/inventario/articulos')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button variant="danger" size="sm">
                Dar de Baja
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-blue-100">
                      <Package className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{article.nombre}</CardTitle>
                      <p className="text-sm text-gray-500">{article.id} • {article.marca} {article.modelo}</p>
                    </div>
                  </div>
                  <Badge variant={article.tipo === 'CONSUMIBLE' ? 'primary' : 'neutral'}>
                    {article.tipo === 'CONSUMIBLE' ? 'CONSUMIBLE' : 'PIEZA REPUESTO'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Marca</p>
                    <p className="text-gray-900">{article.marca}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Modelo</p>
                    <p className="text-gray-900">{article.modelo}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="p-6 pb-0">
                  <Tabs
                    tabs={[
                      {
                        id: 'compatibilidad',
                        label: 'Compatibilidad',
                        content: (
                          <div className="space-y-3 pb-4">
                            {article.compatible_con.length === 0 ? (
                              <p className="text-sm text-gray-500 py-4">No hay impresoras compatibles registradas.</p>
                            ) : (
                              article.compatible_con.map((printer, idx) => (
                                <div key={idx} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
                                  <Link2 className="h-4 w-4 text-blue-500" />
                                  <span className="text-sm text-gray-900">{printer}</span>
                                </div>
                              ))
                            )}
                          </div>
                        ),
                      },
                    ]}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BoxIcon className="h-5 w-5 text-blue-600" />
                  <CardTitle>Stock Actual</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className={`text-3xl font-bold ${getStockColor()}`}>
                    {article.cantidad_en_stock}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">unidades</p>
                  <p className={`text-xs mt-2 font-medium ${getStockColor()}`}>
                    {getStockLabel()}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <CardTitle>Costo Unitario</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(article.costo_unitario)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">por unidad</p>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500">Valor total en stock</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatCurrency(article.costo_unitario * article.cantidad_en_stock)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <CardTitle>Umbral de Reposición</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {article.umbral_reposicion} uds
                  </p>
                  <p className="text-sm text-gray-500 mt-1">mínimo antes de reponer</p>
                </div>
                {article.cantidad_en_stock < article.umbral_reposicion && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="rounded-md bg-amber-50 p-3">
                      <p className="text-xs text-amber-700">
                        Stock por debajo del umbral. Se sugiere reponer {article.umbral_reposicion - article.cantidad_en_stock} unidades.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
