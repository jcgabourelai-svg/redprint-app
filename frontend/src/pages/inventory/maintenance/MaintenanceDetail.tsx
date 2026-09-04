import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Wrench,
  DollarSign,
  User,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit,
  Trash2,
} from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Tabs from '@/components/ui/Tabs'
import {
  useMaintenanceOrder,
  useUpdateMaintenanceOrder,
  useCompleteMaintenanceOrder,
  useCancelMaintenanceOrder,
  useDeleteMaintenanceOrder,
  useAddArticleToMaintenance,
  useRemoveArticleFromMaintenance,
  useCompatibleArticles,
} from '@/hooks/useMaintenanceOrders'
import { useArticles } from '@/hooks/useArticles'
import { useDebounce } from '@/hooks/useDebounce'
import { formatCurrency, formatDate, formatDateTime, getMaintenanceStatusColor } from '@/lib/formatters'
import { problemTypeLabels, severityLabels, severityBadgeVariant } from '@/lib/maintenanceProblem'
import { parseApiError } from '@/lib/api-errors'
import { useIsAdmin } from '@/contexts/AuthContext'

function getEstadoIcon(estado: string) {
  switch (estado) {
    case 'completada':
      return <CheckCircle className="h-5 w-5 text-success" />
    case 'cancelada':
      return <XCircle className="h-5 w-5 text-destructive" />
    default:
      return <AlertCircle className="h-5 w-5 text-primary" />
  }
}

export default function MaintenanceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const orderId = id ? parseInt(id) : 0
  const { data: order, isLoading, error } = useMaintenanceOrder(orderId)
  const completeMutation = useCompleteMaintenanceOrder()
  const cancelMutation = useCancelMaintenanceOrder()
  const updateMutation = useUpdateMaintenanceOrder()
  const deleteMutation = useDeleteMaintenanceOrder()
  const addArticleMutation = useAddArticleToMaintenance()
  const removeArticleMutation = useRemoveArticleFromMaintenance()

  const [showEditModal, setShowEditModal] = useState(false)
  const [editError, setEditError] = useState('')
  const [editFecha, setEditFecha] = useState('')
  const [editDescripcion, setEditDescripcion] = useState('')
  const [editTrabajo, setEditTrabajo] = useState('')
  const [editCosto, setEditCosto] = useState('')

  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [completeError, setCompleteError] = useState('')
  const [completeTrabajo, setCompleteTrabajo] = useState('')
  const [completeCosto, setCompleteCosto] = useState('')
  const [completeContador, setCompleteContador] = useState('')

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Formulario de piezas (solo ordenes PROGRAMADA + admin)
  const [articleSearch, setArticleSearch] = useState('')
  const debouncedArticleSearch = useDebounce(articleSearch, 350)
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null)
  const [articleQty, setArticleQty] = useState('1')
  const [articleError, setArticleError] = useState('')
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null)

  const { data: articlesData } = useArticles(
    order?.estado === 'PROGRAMADA' && isAdmin
      ? debouncedArticleSearch.trim() !== ''
        ? { search: debouncedArticleSearch, per_page: 20 }
        : { per_page: 20 }
      : undefined,
  )

  const { data: compatibleArticles } = useCompatibleArticles(order?.impresora_id ?? 0)
  const compatibleIds = new Set((compatibleArticles ?? []).map((a) => a.id))

  const articles = (articlesData as any)?.data ?? []
  const selectedArticle = articles.find((a: any) => a.id === selectedArticleId) ?? null

  const openEditModal = () => {
    setEditError('')
    setEditFecha(orderData.fecha || '')
    setEditDescripcion(orderData.desc_problema || '')
    setEditTrabajo(orderData.trabajo_realizado || '')
    setEditCosto(orderData.costo_mano_obra != null ? String(orderData.costo_mano_obra) : '')
    setShowEditModal(true)
  }

  const handleAddArticle = async () => {
    setArticleError('')
    const qty = parseInt(articleQty)
    if (!selectedArticleId) {
      setArticleError('Selecciona un artículo de la búsqueda')
      return
    }
    if (!Number.isFinite(qty) || qty < 1) {
      setArticleError('La cantidad debe ser un número entero mayor o igual a 1')
      return
    }
    try {
      await addArticleMutation.mutateAsync({
        orderId,
        articulo_id: selectedArticleId,
        cantidad: qty,
      })
      setSelectedArticleId(null)
      setArticleSearch('')
      setArticleQty('1')
    } catch (err) {
      setArticleError(parseApiError(err))
    }
  }

  const handleRemoveArticle = async (articleUsedId: number) => {
    setArticleError('')
    try {
      await removeArticleMutation.mutateAsync({ orderId, articleUsedId })
    } catch (err) {
      setArticleError(parseApiError(err))
    } finally {
      setConfirmRemoveId(null)
    }
  }

  const handleEditSubmit = async () => {
    setEditError('')
    try {
      await updateMutation.mutateAsync({
        id: orderId,
        fecha: editFecha || undefined,
        desc_problema: editDescripcion || undefined,
        trabajo_realizado: editTrabajo || undefined,
        costo_mano_obra: editCosto === '' ? undefined : parseFloat(editCosto),
      })
      setShowEditModal(false)
    } catch (err) {
      setEditError(parseApiError(err))
    }
  }

  const openDeleteModal = () => {
    setDeleteError('')
    setShowDeleteModal(true)
  }

  const openCompleteModal = () => {
    setCompleteError('')
    setCompleteTrabajo(orderData.trabajo_realizado || '')
    setCompleteCosto(orderData.costo_mano_obra != null ? String(orderData.costo_mano_obra) : '')
    setCompleteContador('')
    setShowCompleteModal(true)
  }

  const handleCompleteSubmit = async () => {
    setCompleteError('')
    const contador = completeContador.trim() === '' ? null : parseInt(completeContador)
    if (contador !== null && (!Number.isFinite(contador) || contador < 0)) {
      setCompleteError('El contador al terminar debe ser un número entero no negativo')
      return
    }
    try {
      await completeMutation.mutateAsync({
        id: orderId,
        trabajo_realizado: completeTrabajo || undefined,
        costo_mano_obra: completeCosto === '' ? undefined : parseFloat(completeCosto),
        contador_impresora: contador,
      })
      setShowCompleteModal(false)
    } catch (err) {
      setCompleteError(parseApiError(err))
    }
  }

  const handleDeleteSubmit = async () => {
    setDeleteError('')
    try {
      await deleteMutation.mutateAsync(orderId)
      setShowDeleteModal(false)
      navigate('/inventario/mantenimiento')
    } catch (err) {
      setDeleteError(parseApiError(err))
    }
  }

  if (isLoading) {
    return (
      <PageLayout title="Inventario › Mantenimiento">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    )
  }

  if (error || !order) {
    return (
      <PageLayout title="Inventario › Mantenimiento">
        <div className="flex items-center justify-center h-64">
          <p className="text-destructive">Orden de mantenimiento no encontrada</p>
        </div>
      </PageLayout>
    )
  }

  const orderData = order as any
  const refacciones = orderData.articles_used || []

  // Total autoritativo del servidor (congelado al completar); la suma de
  // subtotales es solo desglose visual de las filas.
  const costoRefacciones = refacciones.reduce(
    (sum: number, r: any) => sum + Number(r.costo_unitario) * Number(r.cantidad),
    0,
  )
  const costoTotal = orderData.costo_total ?? Number(orderData.costo_mano_obra ?? 0) + costoRefacciones
  const puedeEditarPiezas = orderData.estado === 'PROGRAMADA' && isAdmin

  return (
    <PageLayout title={`Inventario › Mantenimiento › ${orderData.id}`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/inventario/mantenimiento')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={openEditModal}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Button>
              {orderData.estado === 'PROGRAMADA' && (
                <Button size="sm" onClick={openCompleteModal}>
                  Completar
                </Button>
              )}
              {orderData.estado === 'PROGRAMADA' && (
                <Button variant="danger" size="sm" onClick={() => cancelMutation.mutate(orderId)}>
                  Cancelar
                </Button>
              )}
              {(orderData.estado === 'PROGRAMADA' || orderData.estado === 'CANCELADA') && (
                <Button variant="danger" size="sm" onClick={openDeleteModal}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-warning/10">
                      <Wrench className="h-6 w-6 text-warning" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{orderData.id}</CardTitle>
                      <p className="text-sm text-muted-foreground">{orderData.printer?.marca} {orderData.printer?.modelo}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getEstadoIcon(orderData.estado)}
                    <Badge variant="document_status" color={orderData.estado}>
                      {orderData.estado.replace(/_/g, ' ').toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tipo de Servicio</p>
                    <Badge variant={orderData.tipo_mantto === 'PREVENTIVO' ? 'primary' : 'warning'}>
                      {orderData.tipo_mantto === 'PREVENTIVO' ? 'PREVENTIVO' : 'CORRECTIVO'}
                    </Badge>
                  </div>
                  {orderData.tipo_problema && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Tipo de problema</p>
                      <p className="text-foreground">
                        {problemTypeLabels[orderData.tipo_problema] ?? orderData.tipo_problema}
                      </p>
                    </div>
                  )}
                  {orderData.severidad && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Severidad</p>
                      <Badge
                        variant={severityBadgeVariant(orderData.severidad)}
                        className={orderData.severidad === 'CRITICA' ? 'ring-2 ring-red-300' : ''}
                      >
                        {severityLabels[orderData.severidad] ?? orderData.severidad}
                      </Badge>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Fecha</p>
                    <p className="text-foreground">{formatDate(orderData.fecha)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Socio Responsable</p>
                    <p className="text-foreground">{orderData.socio?.nombre ?? '-'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-sm font-medium text-muted-foreground">Descripción</p>
                    <p className="text-foreground">{orderData.desc_problema || '-'}</p>
                  </div>
                  {orderData.foto_evidencia && (
                    <div className="sm:col-span-2">
                      <p className="text-sm font-medium text-muted-foreground">Evidencia fotográfica</p>
                      <a href={orderData.foto_evidencia} target="_blank" rel="noopener noreferrer">
                        <img
                          src={orderData.foto_evidencia}
                          alt="Foto de evidencia de la falla"
                          className="mt-2 max-h-64 rounded-lg border border-border object-cover"
                        />
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="p-6 pb-0">
                  <Tabs
                    tabs={[
                      {
                        id: 'refacciones',
                        label: 'Artículos Usados',
                        content: (
                          <div className="space-y-4 pb-4">
                            {puedeEditarPiezas && (
                              <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
                                <p className="text-sm font-medium text-foreground">Agregar pieza / insumo</p>
                                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                                  <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                                      Buscar artículo
                                    </label>
                                    <Input
                                      value={selectedArticle ? selectedArticle.nombre : articleSearch}
                                      onChange={(e) => {
                                        setSelectedArticleId(null)
                                        setArticleSearch(e.target.value)
                                      }}
                                      placeholder="Nombre, marca o SKU..."
                                    />
                                    {!selectedArticle && articleSearch.trim() !== '' && (
                                      <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-border bg-card divide-y divide-border">
                                        {articles.length === 0 ? (
                                          <p className="px-3 py-2 text-sm text-muted-foreground">
                                            Sin resultados
                                          </p>
                                        ) : (
                                          articles.map((a: any) => (
                                            <button
                                              key={a.id}
                                              type="button"
                                              onClick={() => {
                                                setSelectedArticleId(a.id)
                                                setArticleQty('1')
                                              }}
                                              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-muted"
                                            >
                                              <span className="truncate">
                                                {a.nombre}
                                                {compatibleIds.has(a.id) && (
                                                  <Badge variant="success" className="ml-2">Compatible</Badge>
                                                )}
                                              </span>
                                              <span className="whitespace-nowrap text-xs text-muted-foreground">
                                                {a.stock_actual} disp. — {formatCurrency(a.costo_unitario)}
                                              </span>
                                            </button>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex gap-2 items-end">
                                    <div className="w-24">
                                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                                        Cantidad
                                      </label>
                                      <Input
                                        type="number"
                                        min={1}
                                        value={articleQty}
                                        onChange={(e) => setArticleQty(e.target.value)}
                                      />
                                    </div>
                                    <Button
                                      onClick={handleAddArticle}
                                      loading={addArticleMutation.isPending}
                                      disabled={!selectedArticleId}
                                    >
                                      Agregar
                                    </Button>
                                  </div>
                                </div>
                                {articleError && (
                                  <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                                    {articleError}
                                  </div>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  El costo se congela al agregar. El stock se descarga del inventario al completar la orden.
                                </p>
                              </div>
                            )}

                            {refacciones.length === 0 ? (
                              <div className="text-center py-8">
                                <p className="text-sm text-muted-foreground">
                                  No hay artículos registrados para esta orden
                                </p>
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-border">
                                      <th className="pb-2 text-left text-xs font-medium text-muted-foreground">
                                        Artículo
                                      </th>
                                      <th className="pb-2 text-center text-xs font-medium text-muted-foreground">
                                        Cantidad
                                      </th>
                                      <th className="pb-2 text-right text-xs font-medium text-muted-foreground">
                                        Costo Unit.
                                      </th>
                                      <th className="pb-2 text-right text-xs font-medium text-muted-foreground">
                                        Subtotal
                                      </th>
                                      {puedeEditarPiezas && (
                                        <th className="pb-2 text-right text-xs font-medium text-muted-foreground">
                                          Acciones
                                        </th>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {refacciones.map((ref: any) => (
                                      <tr key={ref.id} className="border-b border-border">
                                        <td className="py-2 font-medium text-foreground">
                                          {ref.article?.nombre}
                                        </td>
                                        <td className="py-2 text-center">{ref.cantidad}</td>
                                        <td className="py-2 text-right">
                                          {formatCurrency(ref.costo_unitario)}
                                        </td>
                                        <td className="py-2 text-right font-medium">
                                          {formatCurrency(ref.costo_unitario * ref.cantidad)}
                                        </td>
                                        {puedeEditarPiezas && (
                                          <td className="py-2 text-right">
                                            {confirmRemoveId === ref.id ? (
                                              <span className="inline-flex items-center gap-2 text-xs">
                                                <span className="text-muted-foreground">¿Quitar?</span>
                                                <Button
                                                  size="sm"
                                                  variant="danger"
                                                  onClick={() => handleRemoveArticle(ref.id)}
                                                  loading={removeArticleMutation.isPending}
                                                >
                                                  Sí
                                                </Button>
                                                <Button size="sm" variant="secondary" onClick={() => setConfirmRemoveId(null)}>
                                                  No
                                                </Button>
                                              </span>
                                            ) : (
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setConfirmRemoveId(ref.id)}
                                                aria-label="Quitar artículo"
                                              >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                              </Button>
                                            )}
                                          </td>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
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
                  <DollarSign className="h-5 w-5 text-success" />
                  <CardTitle>Costo Total</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-3xl font-bold text-foreground">{formatCurrency(costoTotal)}</p>
                </div>
                <div className="mt-4 pt-4 border-t border-border space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Mano de obra</span>
                    <span className="text-foreground">{formatCurrency(orderData.costo_mano_obra)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Artículos</span>
                    <span className="text-foreground">{formatCurrency(costoRefacciones)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <CardTitle>Programación</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{formatDate(orderData.fecha)}</p>
                  <p className="text-sm text-muted-foreground mt-1">fecha programada</p>
                  {orderData.fecha_completado && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Completada el {formatDateTime(orderData.fecha_completado)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  <CardTitle>Responsable</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{orderData.socio?.nombre ?? '-'}</p>
                  <p className="text-sm text-muted-foreground mt-1">socio asignado</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Editar Orden de Mantenimiento"
        size="lg"
      >
        <div className="space-y-4">
          {editError && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {editError}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Fecha Programada
            </label>
            <Input
              type="date"
              value={editFecha}
              onChange={(e) => setEditFecha(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Descripción del Problema
            </label>
            <textarea
              value={editDescripcion}
              onChange={(e) => setEditDescripcion(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Describe el problema o servicio..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Trabajo Realizado
            </label>
            <textarea
              value={editTrabajo}
              onChange={(e) => setEditTrabajo(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Describe el trabajo realizado..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Costo de Mano de Obra ($)
            </label>
            <Input
              type="number"
              step="0.01"
              value={editCosto}
              onChange={(e) => setEditCosto(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => setShowEditModal(false)}
              disabled={updateMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEditSubmit}
              loading={updateMutation.isPending}
            >
              Guardar Cambios
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        title="Completar Orden de Mantenimiento"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Trabajo Realizado
            </label>
            <textarea
              value={completeTrabajo}
              onChange={(e) => setCompleteTrabajo(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Describe el trabajo realizado..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Costo de Mano de Obra ($)
            </label>
            <Input
              type="number"
              step="0.01"
              value={completeCosto}
              onChange={(e) => setCompleteCosto(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Contador al terminar (opcional)
            </label>
            <Input
              type="number"
              min={0}
              value={completeContador}
              onChange={(e) => setCompleteContador(e.target.value)}
              placeholder={`Contador registrado: ${orderData.printer?.contador_actual ?? '-'}`}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Actualiza el contador de la serie con las páginas de pruebas del taller: así no se
              facturan al cliente en el re-ingreso. No puede ser menor al registrado.
            </p>
          </div>
          {completeError && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {completeError}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => setShowCompleteModal(false)}
              disabled={completeMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCompleteSubmit}
              loading={completeMutation.isPending}
            >
              Completar Orden
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Eliminar Orden de Mantenimiento"
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            ¿Estás seguro de que deseas eliminar la orden #{orderId}? Esta acción oculta la orden
            del listado pero se conserva para auditoría.
          </p>
          <div className="bg-destructive/10 rounded p-3 text-xs text-destructive space-y-1">
            {orderData.estado === 'PROGRAMADA' ? (
              <>
                <p>• Se eliminarán los artículos usados de la orden.</p>
                {orderData.tipo_mantto === 'CORRECTIVO' && (
                  <p>• La impresora volverá a su estado anterior.</p>
                )}
              </>
            ) : (
              <p>• La orden ya fue cancelada, no hay datos adicionales por revertir.</p>
            )}
          </div>
          {deleteError && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {deleteError}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
              disabled={deleteMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteSubmit}
              loading={deleteMutation.isPending}
            >
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}
