import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer as PrinterIcon, Calendar, Activity, Settings, Edit, Plus, Trash2 } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Tabs from '@/components/ui/Tabs'
import PrinterForm from '@/components/printer/PrinterForm'
import type { PrinterFormData } from '@/components/printer/PrinterForm'
import { usePrinter, useUpdatePrinter, useDeactivatePrinter, useDeletePrinter } from '@/hooks/usePrinters'
import { useIsAdmin } from '@/contexts/AuthContext'
import { formatCurrency, formatDate } from '@/lib/formatters'

export default function PrinterDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)
  const [deactivateReason, setDeactivateReason] = useState('')
  const [deactivateError, setDeactivateError] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const printerId = id ? parseInt(id) : 0
  const { data: printer, isLoading, error } = usePrinter(printerId)
  const updatePrinter = useUpdatePrinter()
  const deactivatePrinter = useDeactivatePrinter()
  const deletePrinter = useDeletePrinter()

  if (isLoading) {
    return (
      <PageLayout title="Inventario › Impresoras">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    )
  }

  if (error || !printer) {
    return (
      <PageLayout title="Inventario › Impresoras">
        <div className="flex items-center justify-center h-64">
          <p className="text-destructive">Impresora no encontrada</p>
        </div>
      </PageLayout>
    )
  }

  const printerData = printer as any
  const history = printerData.historial || []
  const readings = printerData.lecturas || []
  const maintenance = printerData.mantenimientos || []

  const handleEdit = (data: PrinterFormData) => {
    updatePrinter.mutate(
      { id: printerId, ...data },
      { onSuccess: () => setShowEditModal(false) }
    )
  }

  const handleDeactivate = () => {
    setDeactivateError('')
    deactivatePrinter.mutate(
      { id: printerId, reason: deactivateReason.trim() || undefined },
      {
        onSuccess: () => navigate('/inventario/impresoras'),
        onError: (err: any) => {
          setDeactivateError(
            err?.response?.data?.message || 'No se pudo dar de baja la impresora'
          )
        },
      }
    )
  }

  const handleDelete = () => {
    setDeleteError('')
    deletePrinter.mutate(printerId, {
      onSuccess: () => navigate('/inventario/impresoras'),
      onError: (err: any) => {
        setDeleteError(
          err?.response?.data?.message || 'No se pudo eliminar la impresora'
        )
      },
    })
  }

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
              <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Button>
              {printerData.es_eliminable ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setDeleteError('')
                    setShowDeleteModal(true)
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
              ) : printerData.estado !== 'DADA_DE_BAJA' && (
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
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-primary/10">
                      <PrinterIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">
                        {printerData.marca} {printerData.modelo}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{printerData.id} • {printerData.num_serie}{printerData.num_inventario ? ` • INV: ${printerData.num_inventario}` : ''}</p>
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
                    <p className="text-sm font-medium text-muted-foreground">Marca</p>
                    <p className="text-foreground">{printerData.marca}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Modelo</p>
                    <p className="text-foreground">{printerData.modelo}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Número de Serie</p>
                    <p className="text-foreground">{printerData.num_serie}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Número de Inventario</p>
                    {printerData.num_inventario ? (
                      <p className="text-foreground font-medium">{printerData.num_inventario}</p>
                    ) : (
                      <p className="text-warning italic flex items-center gap-1">
                        Sin asignar
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Fecha de Adquisición</p>
                    <p className="text-foreground">{formatDate(printerData.fecha_adquisicion)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Costo de Adquisición</p>
                    <p className="text-foreground">{formatCurrency(printerData.costo_adquisicion)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Vida Útil Estimada</p>
                    <p className="text-foreground">{printerData.vida_util_meses} meses</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Ubicación Actual</p>
                    <p className="text-foreground">{printerData.warehouse?.direccion || printerData.codigo_negocio || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Almacén</p>
                    <p className="text-foreground">{printerData.warehouse?.nombre || '-'}</p>
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
                              <p className="text-sm text-muted-foreground py-4">No hay eventos en el historial.</p>
                            ) : (
                              history.map((event: any) => (
                                <div key={event.id} className="flex gap-4 border-b border-border pb-4 last:border-0">
                                  <div className="text-sm text-muted-foreground min-w-[100px]">
                                    {formatDate(event.fecha)}
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-foreground">{event.tipo}</p>
                                    <p className="text-xs text-muted-foreground">{event.descripcion}</p>
                                    {event.detalles && (
                                      <p className="text-xs text-muted-foreground mt-1">{event.detalles}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1">Responsable: {event.responsable}</p>
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
                                <p className="text-sm text-muted-foreground">No hay órdenes de mantenimiento registradas</p>
                                {isAdmin && (
                                  <Button size="sm" className="mt-3">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Nueva Orden
                                  </Button>
                                )}
                              </div>
                            ) : (
                              maintenance.map((order: any) => (
                                <div key={order.id} className="border border-border rounded-lg p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm font-medium">{order.id} - {formatDate(order.fecha)}</p>
                                    <Badge variant="document_status" color={order.estado}>
                                      {(order.estado || '').replace(/_/g, ' ').toUpperCase()}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">Tipo: {(order.tipo_mantto || '').toLowerCase() === 'preventivo' ? 'Preventivo' : 'Correctivo'}</p>
                                  <p className="text-xs text-muted-foreground">Responsable: {order.socio?.nombre ?? '-'}</p>
                                  <p className="text-xs text-muted-foreground">Costo: {formatCurrency(order.costo_mano_obra)}</p>
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
                              <p className="text-sm text-muted-foreground py-4">No hay lecturas registradas.</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-border">
                                      <th className="pb-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                                      <th className="pb-2 text-right text-xs font-medium text-muted-foreground">Contador</th>
                                      <th className="pb-2 text-right text-xs font-medium text-muted-foreground">Consumo</th>
                                      <th className="pb-2 text-left text-xs font-medium text-muted-foreground">Visitante</th>
                                      <th className="pb-2 text-center text-xs font-medium text-muted-foreground">Estado</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {readings.map((reading: any) => (
                                      <tr key={reading.id} className="border-b border-border">
                                        <td className="py-2 text-muted-foreground">{formatDate(reading.fecha)}</td>
                                        <td className="py-2 text-right tabular-nums">{Number(reading.valor_contador ?? 0).toLocaleString('es-MX')}</td>
                                        <td className="py-2 text-right tabular-nums text-success">+{Number(reading.paginas_periodo ?? 0).toLocaleString('es-MX')}</td>
                                        <td className="py-2 text-muted-foreground">{reading.socio_capturista || '-'}</td>
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
                  <Activity className="h-5 w-5 text-primary" />
                  <CardTitle>Contador</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-3xl font-bold text-foreground tabular-nums">
                    {(printerData.contador_actual ?? 0).toLocaleString('es-MX')}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">páginas totales</p>
                </div>
                {printerData.ultima_lectura !== undefined && printerData.fecha_ultima_lectura && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground">Última lectura</p>
                    <p className="text-sm text-foreground">{formatDate(printerData.fecha_ultima_lectura)}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {printerData.vida_util_restante !== undefined && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-success" />
                    <CardTitle>Vida Útil</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${(printerData.vida_util_restante ?? 0) <= 12 ? 'text-destructive' : 'text-success'}`}>
                      {printerData.vida_util_restante} meses
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">restantes</p>
                  </div>
                  {printerData.garantia_hasta && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground">Garantía hasta</p>
                      <p className="text-sm text-foreground">{formatDate(printerData.garantia_hasta)}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {printerData.stock_consumibles !== undefined && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-warning" />
                    <CardTitle>Stock Consumibles</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${printerData.stock_consumibles <= 3 ? 'text-destructive' : 'text-warning'}`}>
                      {printerData.stock_consumibles} uds
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">disponibles</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Editar Impresora"
        size="lg"
      >
        <PrinterForm
          initialData={printerData}
          onSubmit={handleEdit}
          onCancel={() => setShowEditModal(false)}
          isEdit
          loading={updatePrinter.isPending}
        />
      </Modal>

      <Modal
        isOpen={showDeactivateModal}
        onClose={() => setShowDeactivateModal(false)}
        title="Dar de Baja Impresora"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            ¿Seguro que deseas dar de baja la impresora{' '}
            <span className="font-medium text-foreground">
              {printerData.marca} {printerData.modelo}
            </span>
            ? Esta acción no se puede deshacer.
          </p>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Motivo de baja <span className="text-muted-foreground">(opcional)</span>
            </label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Ej: Fin de vida útil, daño irreparable..."
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
              disabled={deactivatePrinter.isPending}
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
              disabled={deactivatePrinter.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeactivate}
              loading={deactivatePrinter.isPending}
            >
              Confirmar Baja
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Eliminar Impresora"
      >
        <div className="space-y-4">
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-sm text-destructive">
              Estás por <span className="font-semibold">borrar definitivamente</span> el registro de la impresora{' '}
              <span className="font-semibold">
                {printerData.marca} {printerData.modelo}
              </span>{' '}
              ({printerData.num_serie}). Esta acción <span className="font-semibold">no se puede deshacer</span> y eliminará también su historial.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Esto se recomienda solo para correcciones por error de captura. Si la impresora realmente existió y salió de circulación, usa <span className="font-medium">Dar de baja</span> en su lugar para conservar el historial.
          </p>
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
              disabled={deletePrinter.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              loading={deletePrinter.isPending}
            >
              Sí, Eliminar Definitivamente
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}
