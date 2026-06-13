import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Wrench,
  Clock,
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
import { useMaintenanceOrder, useUpdateMaintenanceOrder, useCompleteMaintenanceOrder, useCancelMaintenanceOrder, useDeleteMaintenanceOrder } from '@/hooks/useMaintenanceOrders'
import { formatCurrency, formatDate, getMaintenanceStatusColor } from '@/lib/formatters'
import { parseApiError } from '@/lib/api-errors'
import { useIsAdmin } from '@/contexts/AuthContext'

function getEstadoIcon(estado: string) {
  switch (estado) {
    case 'completada':
      return <CheckCircle className="h-5 w-5 text-green-500" />
    case 'cancelada':
      return <XCircle className="h-5 w-5 text-red-500" />
    case 'en_progreso':
      return <Clock className="h-5 w-5 text-amber-500" />
    default:
      return <AlertCircle className="h-5 w-5 text-blue-500" />
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

  const [showEditModal, setShowEditModal] = useState(false)
  const [editError, setEditError] = useState('')
  const [editFecha, setEditFecha] = useState('')
  const [editDescripcion, setEditDescripcion] = useState('')
  const [editTrabajo, setEditTrabajo] = useState('')
  const [editCosto, setEditCosto] = useState('')

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const openEditModal = () => {
    setEditError('')
    setEditFecha(orderData.fecha || '')
    setEditDescripcion(orderData.desc_problema || '')
    setEditTrabajo(orderData.trabajo_realizado || '')
    setEditCosto(orderData.costo_mano_obra != null ? String(orderData.costo_mano_obra) : '')
    setShowEditModal(true)
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </PageLayout>
    )
  }

  if (error || !order) {
    return (
      <PageLayout title="Inventario › Mantenimiento">
        <div className="flex items-center justify-center h-64">
          <p className="text-red-600">Orden de mantenimiento no encontrada</p>
        </div>
      </PageLayout>
    )
  }

  const orderData = order as any
  const refacciones = orderData.articles_used || []
  const notas = orderData.notas || []

  const costoRefacciones = refacciones.reduce(
    (sum: number, r: any) => sum + r.costo_unitario * r.cantidad,
    0,
  )
  const costoTotal = orderData.costo_mano_obra + costoRefacciones

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
                <Button size="sm" onClick={() => completeMutation.mutate({ id: orderId })}>
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
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-amber-100">
                      <Wrench className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{orderData.id}</CardTitle>
                      <p className="text-sm text-gray-500">{orderData.printer?.marca} {orderData.printer?.modelo}</p>
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
                    <p className="text-sm font-medium text-gray-600">Tipo de Servicio</p>
                    <Badge variant={orderData.tipo_mantto === 'PREVENTIVO' ? 'primary' : 'warning'}>
                      {orderData.tipo_mantto === 'PREVENTIVO' ? 'PREVENTIVO' : 'CORRECTIVO'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Fecha</p>
                    <p className="text-gray-900">{formatDate(orderData.fecha)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Socio Responsable</p>
                    <p className="text-gray-900">{orderData.socio?.nombre ?? '-'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-sm font-medium text-gray-600">Descripción</p>
                    <p className="text-gray-900">{orderData.desc_problema || '-'}</p>
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
                        id: 'refacciones',
                        label: 'Artículos Usados',
                        content: (
                          <div className="space-y-4 pb-4">
                            {refacciones.length === 0 ? (
                              <div className="text-center py-8">
                                <p className="text-sm text-gray-500">
                                  No hay artículos registrados para esta orden
                                </p>
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-gray-200">
                                      <th className="pb-2 text-left text-xs font-medium text-gray-500">
                                        Artículo
                                      </th>
                                      <th className="pb-2 text-center text-xs font-medium text-gray-500">
                                        Cantidad
                                      </th>
                                      <th className="pb-2 text-right text-xs font-medium text-gray-500">
                                        Costo Unit.
                                      </th>
                                      <th className="pb-2 text-right text-xs font-medium text-gray-500">
                                        Subtotal
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {refacciones.map((ref: any) => (
                                      <tr key={ref.id} className="border-b border-gray-100">
                                        <td className="py-2 font-medium text-gray-900">
                                          {ref.article?.nombre}
                                        </td>
                                        <td className="py-2 text-center">{ref.cantidad}</td>
                                        <td className="py-2 text-right">
                                          {formatCurrency(ref.costo_unitario)}
                                        </td>
                                        <td className="py-2 text-right font-medium">
                                          {formatCurrency(ref.costo_unitario * ref.cantidad)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        ),
                      },
                      {
                        id: 'notas',
                        label: 'Notas',
                        content: (
                          <div className="space-y-4 pb-4">
                            {notas.length === 0 ? (
                              <div className="text-center py-8">
                                <p className="text-sm text-gray-500">
                                  No hay notas registradas para esta orden
                                </p>
                              </div>
                            ) : (
                              notas.map((nota: any) => (
                                <div
                                  key={nota.id}
                                  className="border border-gray-200 rounded-lg p-4"
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm font-medium text-gray-900">
                                      {nota.autor}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {formatDate(nota.fecha)}
                                    </p>
                                  </div>
                                  <p className="text-sm text-gray-700">{nota.texto}</p>
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
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <CardTitle>Costo Total</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900">{formatCurrency(costoTotal)}</p>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Mano de obra</span>
                    <span className="text-gray-900">{formatCurrency(orderData.costo_mano_obra)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Artículos</span>
                    <span className="text-gray-900">{formatCurrency(costoRefacciones)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <CardTitle>Programación</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{formatDate(orderData.fecha)}</p>
                  <p className="text-sm text-gray-500 mt-1">fecha programada</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-purple-600" />
                  <CardTitle>Responsable</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{orderData.socio?.nombre ?? '-'}</p>
                  <p className="text-sm text-gray-500 mt-1">socio asignado</p>
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
            <div className="p-3 text-sm text-red-700 bg-red-50 rounded-md">
              {editError}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Programada
            </label>
            <Input
              type="date"
              value={editFecha}
              onChange={(e) => setEditFecha(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción del Problema
            </label>
            <textarea
              value={editDescripcion}
              onChange={(e) => setEditDescripcion(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Describe el problema o servicio..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trabajo Realizado
            </label>
            <textarea
              value={editTrabajo}
              onChange={(e) => setEditTrabajo(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Describe el trabajo realizado..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Eliminar Orden de Mantenimiento"
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            ¿Estás seguro de que deseas eliminar la orden #{orderId}? Esta acción oculta la orden
            del listado pero se conserva para auditoría.
          </p>
          <div className="bg-red-50 rounded p-3 text-xs text-red-700 space-y-1">
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
            <div className="p-3 text-sm text-red-700 bg-red-50 rounded-md">
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
