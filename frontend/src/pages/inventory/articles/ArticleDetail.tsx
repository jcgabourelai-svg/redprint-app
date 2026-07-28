import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Package, AlertTriangle, DollarSign, BoxIcon, Link2, Edit, SlidersHorizontal, Pencil, Plus } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import MultiSelect from '@/components/ui/MultiSelect'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Tabs from '@/components/ui/Tabs'
import { useArticle, useArticleCompatiblePrinters, useDeactivateArticle, useCreateArticleMovement, useUpdateArticle } from '@/hooks/useArticles'
import { useAllPrinters } from '@/hooks/usePrinters'
import { useIsAdmin } from '@/contexts/AuthContext'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { Article } from '@/types/article'

export default function ArticleDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const articleId = id ? parseInt(id) : 0
  const { data: article, isLoading, error } = useArticle(articleId)
  const { data: compatiblePrinters } = useArticleCompatiblePrinters(articleId)
  const deactivateArticle = useDeactivateArticle()
  const createMovement = useCreateArticleMovement()
  const updateArticle = useUpdateArticle()
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)
  const [deactivateReason, setDeactivateReason] = useState('')
  const [deactivateError, setDeactivateError] = useState('')
  const [showStockModal, setShowStockModal] = useState(false)
  const [editingCompat, setEditingCompat] = useState(false)
  const { data: printers, isLoading: isLoadingPrinters } = useAllPrinters(editingCompat)
  const [compatDraft, setCompatDraft] = useState<string[]>([])
  const [compatError, setCompatError] = useState('')

  if (isLoading) {
    return (
      <PageLayout title="Inventario › Artículos">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    )
  }

  if (error || !article) {
    return (
      <PageLayout title="Inventario › Artículos">
        <div className="flex items-center justify-center h-64">
          <p className="text-destructive">Artículo no encontrado</p>
        </div>
      </PageLayout>
    )
  }

  const getStockColor = () => {
    if (article.stock_actual === 0) return 'text-destructive'
    if (article.stock_actual < article.umbral_reposicion) return 'text-warning'
    return 'text-success'
  }

  const getStockLabel = () => {
    if (article.stock_actual === 0) return 'Agotado'
    if (article.stock_actual < article.umbral_reposicion) return 'Bajo stock'
    return 'Stock suficiente'
  }

  const handleDeactivate = () => {
    setDeactivateError('')
    deactivateArticle.mutate(
      { id: articleId, reason: deactivateReason.trim() || undefined },
      {
        onSuccess: () => navigate('/inventario/articulos'),
        onError: (err: any) => {
          setDeactivateError(
            err?.response?.data?.message || 'No se pudo dar de baja el artículo'
          )
        },
      }
    )
  }

  const startEditCompat = () => {
    setCompatError('')
    setCompatDraft((article.impresoras_compatibles ?? []).map(String))
    setEditingCompat(true)
  }

  const cancelEditCompat = () => {
    setEditingCompat(false)
    setCompatError('')
  }

  const saveCompat = () => {
    setCompatError('')
    updateArticle.mutate(
      { id: articleId, impresoras_compatibles: compatDraft.map(Number) },
      {
        onSuccess: () => setEditingCompat(false),
        onError: (err: any) => {
          setCompatError(err?.response?.data?.message || 'No se pudo actualizar la compatibilidad')
        },
      }
    )
  }

  return (
    <PageLayout title={`Inventario › Artículos › ${article.nombre}`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/inventario/articulos')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          {isAdmin && article.activo !== false && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={startEditCompat}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowStockModal(true)}>
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Ajustar Stock
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setDeactivateError('')
                  setShowDeactivateModal(true)
                }}
              >
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
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-primary/10">
                      <Package className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{article.nombre}</CardTitle>
                      <p className="text-sm text-muted-foreground">{article.id} • {article.marca} {article.modelo_sku}</p>
                    </div>
                  </div>
                  <Badge variant={article.tipo_articulo === 'CONSUMIBLE' ? 'primary' : 'neutral'}>
                    {article.tipo_articulo === 'CONSUMIBLE' ? 'CONSUMIBLE' : 'PIEZA REPUESTO'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Marca</p>
                    <p className="text-foreground">{article.marca}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Modelo</p>
                    <p className="text-foreground">{article.modelo_sku}</p>
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
                            {isAdmin && !editingCompat && (
                              <div className="flex justify-end">
                                <Button variant="ghost" size="sm" onClick={startEditCompat}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Editar compatibilidad
                                </Button>
                              </div>
                            )}

                            {editingCompat ? (
                              <div className="space-y-3">
                                {isLoadingPrinters ? (
                                  <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                    Cargando impresoras...
                                  </div>
                                ) : (
                                  <MultiSelect
                                    options={(printers ?? []).map((p) => ({
                                      value: String(p.id),
                                      label: `${p.marca} ${p.modelo}${p.numero_serie ? ` · ${p.numero_serie}` : ''} (#${p.id})`,
                                    }))}
                                    value={compatDraft}
                                    onChange={setCompatDraft}
                                    searchable
                                    placeholder="Selecciona las impresoras compatibles..."
                                  />
                                )}
                                {compatError && (
                                  <p className="text-sm text-destructive">{compatError}</p>
                                )}
                                <div className="flex justify-end gap-2 pt-1">
                                  <Button variant="secondary" size="sm" onClick={cancelEditCompat} disabled={updateArticle.isPending}>
                                    Cancelar
                                  </Button>
                                  <Button size="sm" onClick={saveCompat} loading={updateArticle.isPending}>
                                    Guardar
                                  </Button>
                                </div>
                              </div>
                            ) : (compatiblePrinters ?? []).length === 0 ? (
                              <div className="py-4">
                                <p className="text-sm text-muted-foreground">No hay impresoras compatibles registradas.</p>
                                {isAdmin && (
                                  <Button variant="outline" size="sm" className="mt-3" onClick={startEditCompat}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Agregar impresoras
                                  </Button>
                                )}
                              </div>
                            ) : (
                              (compatiblePrinters as any[]).map((printer) => (
                                <div key={printer.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                                  <Link2 className="h-4 w-4 text-primary" />
                                  <span className="text-sm text-foreground flex-1">{printer.id} • {printer.marca} {printer.modelo}</span>
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
                  <BoxIcon className="h-5 w-5 text-primary" />
                  <CardTitle>Stock Actual</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className={`text-3xl font-bold ${getStockColor()}`}>
                    {article.stock_actual}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">unidades</p>
                  <p className={`text-xs mt-2 font-medium ${getStockColor()}`}>
                    {getStockLabel()}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-success" />
                  <CardTitle>Costo Unitario</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(article.costo_unitario)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">por unidad</p>
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">Valor total en stock</p>
                  <p className="text-sm font-medium text-foreground">
                    {formatCurrency(article.costo_unitario * article.stock_actual)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <CardTitle>Umbral de Reposición</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">
                    {article.umbral_reposicion} uds
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">mínimo antes de reponer</p>
                </div>
                {article.stock_actual < article.umbral_reposicion && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="rounded-md bg-warning/10 p-3">
                      <p className="text-xs text-warning">
                        Stock por debajo del umbral. Se sugiere reponer {article.umbral_reposicion - article.stock_actual} unidades.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showDeactivateModal}
        onClose={() => setShowDeactivateModal(false)}
        title="Dar de Baja Artículo"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            ¿Seguro que deseas dar de baja el artículo{' '}
            <span className="font-medium text-foreground">{article.nombre}</span>
            ? Ya no aparecerá en el listado de inventario activo.
          </p>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Motivo de baja <span className="text-muted-foreground">(opcional)</span>
            </label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Ej: Obsoleto, descontinuado..."
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
              disabled={deactivateArticle.isPending}
            />
          </div>
          {deactivateError && (
            <p className="text-sm text-destructive">{deactivateError}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowDeactivateModal(false)}
              disabled={deactivateArticle.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeactivate}
              loading={deactivateArticle.isPending}
            >
              Confirmar Baja
            </Button>
          </div>
        </div>
      </Modal>

      {article && (
        <StockAdjustmentModal
          article={article}
          isOpen={showStockModal}
          onClose={() => setShowStockModal(false)}
          submitting={createMovement.isPending}
          onSubmit={(data) => {
            createMovement.mutate(
              { articleId, ...data },
              {
                onSuccess: () => setShowStockModal(false),
              }
            )
          }}
          submitError={createMovement.error ? (createMovement.error as any)?.response?.data?.message : ''}
        />
      )}
    </PageLayout>
  )
}

const movementTypeOptions = [
  { value: 'ENTRADA', label: 'Entrada (sumar unidades)' },
  { value: 'SALIDA', label: 'Salida (restar unidades)' },
  { value: 'AJUSTE', label: 'Ajuste (fijar stock absoluto)' },
]

function StockAdjustmentModal({
  article,
  isOpen,
  onClose,
  onSubmit,
  submitting,
  submitError,
}: {
  article: Article
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { tipo_movimiento: string; cantidad?: number; stock_destino?: number; justificacion: string }) => void
  submitting: boolean
  submitError: string
}) {
  const [tipo, setTipo] = useState('ENTRADA')
  const [cantidad, setCantidad] = useState('')
  const [stockDestino, setStockDestino] = useState('')
  const [justificacion, setJustificacion] = useState('')
  const [error, setError] = useState('')

  const qtyNum = Number(cantidad)
  const destNum = Number(stockDestino)
  const currentStock = article.stock_actual

  const previewStock = () => {
    if (tipo === 'ENTRADA') return currentStock + (isNaN(qtyNum) ? 0 : qtyNum)
    if (tipo === 'SALIDA') return currentStock - (isNaN(qtyNum) ? 0 : qtyNum)
    if (tipo === 'AJUSTE') return isNaN(destNum) ? currentStock : destNum
    return currentStock
  }

  const validate = (): boolean => {
    const errs: string[] = []
    if (!justificacion.trim() || justificacion.trim().length < 3) {
      errs.push('La justificación es obligatoria (mínimo 3 caracteres).')
    }
    if (tipo !== 'AJUSTE') {
      if (!cantidad || isNaN(qtyNum) || qtyNum < 1) {
        errs.push('La cantidad debe ser un número entero mayor o igual a 1.')
      }
      if (tipo === 'SALIDA' && qtyNum > currentStock) {
        errs.push(`Stock insuficiente. Stock actual: ${currentStock}, solicitado: ${qtyNum}.`)
      }
    } else {
      if (!stockDestino || isNaN(destNum) || destNum < 0) {
        errs.push('El stock destino debe ser un número mayor o igual a 0.')
      }
    }
    setError(errs.join(' '))
    return errs.length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    onSubmit({
      tipo_movimiento: tipo,
      cantidad: tipo !== 'AJUSTE' ? qtyNum : undefined,
      stock_destino: tipo === 'AJUSTE' ? destNum : undefined,
      justificacion: justificacion.trim(),
    })
  }

  const preview = previewStock()
  const previewColor = preview < currentStock ? 'text-warning' : preview > currentStock ? 'text-success' : 'text-muted-foreground'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajustar Stock" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <p className="text-sm text-muted-foreground">{article.nombre}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xs text-muted-foreground">Stock actual:</span>
            <span className="text-lg font-bold text-foreground">{currentStock}</span>
            <span className="text-xs text-muted-foreground">unidades</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Tipo de movimiento</label>
          <Select options={movementTypeOptions} value={tipo} onChange={(v) => setTipo(v)} />
        </div>

        {tipo !== 'AJUSTE' ? (
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Cantidad</label>
            <Input
              type="number"
              min={1}
              placeholder="0"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Stock destino (absoluto)</label>
            <Input
              type="number"
              min={0}
              placeholder="0"
              value={stockDestino}
              onChange={(e) => setStockDestino(e.target.value)}
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Justificación <span className="text-destructive">*</span>
          </label>
          <textarea
            className="flex min-h-[72px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="Ej: Conteo físico, merma, compra local..."
            value={justificacion}
            onChange={(e) => setJustificacion(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="rounded-md border border-border p-3 bg-card">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Stock resultante:</span>
            <span className={`text-base font-bold tabular-nums ${previewColor}`}>
              {currentStock} → {preview}
            </span>
          </div>
        </div>

        {(error || submitError) && (
          <p className="text-sm text-destructive">{error || submitError}</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            Registrar movimiento
          </Button>
        </div>
      </form>
    </Modal>
  )
}
