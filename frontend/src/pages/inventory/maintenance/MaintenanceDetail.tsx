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
} from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Tabs from '@/components/ui/Tabs'
import { useMaintenanceOrder } from '@/hooks/useMaintenanceOrders'
import { useCompleteMaintenanceOrder, useCancelMaintenanceOrder } from '@/hooks/useMaintenanceOrders'
import { formatCurrency, formatDate, getMaintenanceStatusColor } from '@/lib/formatters'
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
  const refacciones = orderData.articulos_usados || []
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
              <Button variant="outline" size="sm">
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Button>
              {orderData.estado === 'PENDIENTE' && (
                <Button size="sm" onClick={() => completeMutation.mutate(orderId)}>
                  Iniciar Servicio
                </Button>
              )}
              {orderData.estado === 'en_progreso' && (
                <Button size="sm" onClick={() => completeMutation.mutate(orderId)}>
                  Completar
                </Button>
              )}
              {orderData.estado !== 'completada' && (
                <Button variant="danger" size="sm" onClick={() => cancelMutation.mutate(orderId)}>
                  Cancelar
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
                      <p className="text-sm text-gray-500">{orderData.impresora_marca} {orderData.impresora_modelo}</p>
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
                    <Badge variant={orderData.tipo === 'preventivo' ? 'primary' : 'warning'}>
                      {orderData.tipo === 'preventivo' ? 'PREVENTIVO' : 'CORRECTIVO'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Fecha</p>
                    <p className="text-gray-900">{formatDate(orderData.fecha)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Socio Responsable</p>
                    <p className="text-gray-900">{orderData.socio_responsable}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-sm font-medium text-gray-600">Descripción</p>
                    <p className="text-gray-900">{orderData.descripcion}</p>
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
                                          {ref.articulo_nombre}
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
                  <p className="text-lg font-bold text-gray-900">{orderData.socio_responsable}</p>
                  <p className="text-sm text-gray-500 mt-1">socio asignado</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
