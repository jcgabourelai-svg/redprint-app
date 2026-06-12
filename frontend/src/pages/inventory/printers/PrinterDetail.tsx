import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer as PrinterIcon, Calendar, Activity, Settings, Edit, Plus } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Tabs from '@/components/ui/Tabs'
import { usePrinter } from '@/hooks/usePrinters'
import { useIsAdmin } from '@/contexts/AuthContext'
import { formatCurrency, formatDate } from '@/lib/formatters'

export default function PrinterDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const printerId = id ? parseInt(id) : 0
  const { data: printer, isLoading, error } = usePrinter(printerId)

  if (isLoading) {
    return (
      <PageLayout title="Inventario › Impresoras">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </PageLayout>
    )
  }

  if (error || !printer) {
    return (
      <PageLayout title="Inventario › Impresoras">
        <div className="flex items-center justify-center h-64">
          <p className="text-red-600">Impresora no encontrada</p>
        </div>
      </PageLayout>
    )
  }

  const printerData = printer as any
  const history = printerData.historial || []
  const readings = printerData.lecturas || []
  const maintenance = printerData.mantenimientos || []

  return (
    <PageLayout title={`Inventario › Impresoras › ${printerData.marca} ${printerData.modelo}`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/inventario/impresoras')}>
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
                      <PrinterIcon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">
                        {printerData.marca} {printerData.modelo}
                      </CardTitle>
                      <p className="text-sm text-gray-500">{printerData.id} • {printerData.num_serie}</p>
                    </div>
                  </div>
                  <Badge variant="printer_status" color={printerData.estado}>
                    {(printerData.estado || '').replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Marca</p>
                    <p className="text-gray-900">{printerData.marca}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Modelo</p>
                    <p className="text-gray-900">{printerData.modelo}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Número de Serie</p>
                    <p className="text-gray-900">{printerData.num_serie}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Fecha de Adquisición</p>
                    <p className="text-gray-900">{formatDate(printerData.fecha_adquisicion)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Costo de Adquisición</p>
                    <p className="text-gray-900">{formatCurrency(printerData.costo_adquisicion)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Vida Útil Estimada</p>
                    <p className="text-gray-900">{printerData.vida_util_meses} meses</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Ubicación Actual</p>
                    <p className="text-gray-900">{printerData.warehouse?.direccion || printerData.codigo_negocio || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Almacén</p>
                    <p className="text-gray-900">{printerData.warehouse?.nombre || '-'}</p>
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
                        id: 'historial',
                        label: 'Historial',
                        content: (
                          <div className="space-y-4 pb-4">
                            {history.length === 0 ? (
                              <p className="text-sm text-gray-500 py-4">No hay eventos en el historial.</p>
                            ) : (
                              history.map((event: any) => (
                                <div key={event.id} className="flex gap-4 border-b border-gray-100 pb-4 last:border-0">
                                  <div className="text-sm text-gray-500 min-w-[100px]">
                                    {formatDate(event.fecha)}
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">{event.tipo}</p>
                                    <p className="text-xs text-gray-500">{event.descripcion}</p>
                                    {event.detalles && (
                                      <p className="text-xs text-gray-400 mt-1">{event.detalles}</p>
                                    )}
                                    <p className="text-xs text-gray-400 mt-1">Responsable: {event.responsable}</p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        ),
                      },
                      {
                        id: 'mantenimientos',
                        label: 'Mantenimientos',
                        content: (
                          <div className="space-y-4 pb-4">
                            {maintenance.length === 0 ? (
                              <div className="text-center py-8">
                                <p className="text-sm text-gray-500">No hay órdenes de mantenimiento registradas</p>
                                {isAdmin && (
                                  <Button size="sm" className="mt-3">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Nueva Orden
                                  </Button>
                                )}
                              </div>
                            ) : (
                              maintenance.map((order: any) => (
                                <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm font-medium">{order.id} - {formatDate(order.fecha)}</p>
                                    <Badge variant="document_status" color={order.estado}>
                                      {(order.estado || '').replace(/_/g, ' ').toUpperCase()}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-gray-500">Tipo: {(order.tipo_mantto || '').toLowerCase() === 'preventivo' ? 'Preventivo' : 'Correctivo'}</p>
                                  <p className="text-xs text-gray-500">Responsable: {order.socio?.nombre ?? '-'}</p>
                                  <p className="text-xs text-gray-500">Costo: {formatCurrency(order.costo_mano_obra)}</p>
                                </div>
                              ))
                            )}
                          </div>
                        ),
                      },
                      {
                        id: 'lecturas',
                        label: 'Lecturas',
                        content: (
                          <div className="pb-4">
                            {readings.length === 0 ? (
                              <p className="text-sm text-gray-500 py-4">No hay lecturas registradas.</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-gray-200">
                                      <th className="pb-2 text-left text-xs font-medium text-gray-500">Fecha</th>
                                      <th className="pb-2 text-right text-xs font-medium text-gray-500">Contador</th>
                                      <th className="pb-2 text-right text-xs font-medium text-gray-500">Consumo</th>
                                      <th className="pb-2 text-left text-xs font-medium text-gray-500">Visitante</th>
                                      <th className="pb-2 text-center text-xs font-medium text-gray-500">Estado</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {readings.map((reading: any) => (
                                      <tr key={reading.id} className="border-b border-gray-100">
                                        <td className="py-2 text-gray-700">{formatDate(reading.fecha)}</td>
                                        <td className="py-2 text-right tabular-nums">{Number(reading.valor_contador ?? 0).toLocaleString('es-MX')}</td>
                                        <td className="py-2 text-right tabular-nums text-green-600">+{Number(reading.paginas_periodo ?? 0).toLocaleString('es-MX')}</td>
                                        <td className="py-2 text-gray-700">{reading.socio_capturista || '-'}</td>
                                        <td className="py-2 text-center">
                                          {reading.es_anomalia ? '⚠️' : '✅'}
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
                  <Activity className="h-5 w-5 text-blue-600" />
                  <CardTitle>Contador</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900 tabular-nums">
                    {(printerData.contador_actual ?? 0).toLocaleString('es-MX')}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">páginas totales</p>
                </div>
                {printerData.ultima_lectura !== undefined && printerData.fecha_ultima_lectura && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500">Última lectura</p>
                    <p className="text-sm text-gray-900">{formatDate(printerData.fecha_ultima_lectura)}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {printerData.vida_util_restante !== undefined && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-green-600" />
                    <CardTitle>Vida Útil</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${(printerData.vida_util_restante ?? 0) <= 12 ? 'text-red-600' : 'text-green-600'}`}>
                      {printerData.vida_util_restante} meses
                    </p>
                    <p className="text-sm text-gray-500 mt-1">restantes</p>
                  </div>
                  {printerData.garantia_hasta && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-xs text-gray-500">Garantía hasta</p>
                      <p className="text-sm text-gray-900">{formatDate(printerData.garantia_hasta)}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {printerData.stock_consumibles !== undefined && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-amber-600" />
                    <CardTitle>Stock Consumibles</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${printerData.stock_consumibles <= 3 ? 'text-red-600' : 'text-amber-600'}`}>
                      {printerData.stock_consumibles} uds
                    </p>
                    <p className="text-sm text-gray-500 mt-1">disponibles</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
