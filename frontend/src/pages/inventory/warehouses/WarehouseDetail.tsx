import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Pencil,
  Trash2,
  MapPin,
  User,
  Calendar,
  Warehouse as WarehouseIcon,
  Search,
} from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import WarehouseStats from '@/components/warehouse/WarehouseStats'
import WarehouseForm from '@/components/warehouse/WarehouseForm'
import { useWarehouse, useUpdateWarehouse, useDeleteWarehouse } from '@/hooks/useWarehouses'
import { formatDate } from '@/lib/formatters'
import { useIsAdmin } from '@/contexts/AuthContext'
import type { WarehouseFormData } from '@/types/warehouse'

export default function WarehouseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [printerSearch, setPrinterSearch] = useState('')
  const [printerStatusFilter, setPrinterStatusFilter] = useState<string>('all')

  const warehouseId = id ? parseInt(id) : 0
  const { data: warehouse, isLoading, error } = useWarehouse(warehouseId)
  const updateMutation = useUpdateWarehouse()
  const deleteMutation = useDeleteWarehouse()

  if (isLoading) {
    return (
      <PageLayout title="Inventario › Almacenes">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    )
  }

  if (error || !warehouse) {
    return (
      <PageLayout title="Inventario › Almacenes">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <WarehouseIcon className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">Almacén no encontrado</h3>
          <p className="text-sm text-muted-foreground mb-4">
            El almacén con ID "{id}" no existe o fue eliminado.
          </p>
          <Button onClick={() => navigate('/inventario/almacenes')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Almacenes
          </Button>
        </div>
      </PageLayout>
    )
  }

  const handleEdit = (data: WarehouseFormData) => {
    updateMutation.mutate(
      { id: warehouse.id, data },
      {
        onSuccess: () => setShowEditModal(false),
        onError: (err: any) => {
          console.error('Error al actualizar almacén:', err)
        },
      }
    )
  }

  const handleDelete = () => {
    deleteMutation.mutate(String(warehouse.id), {
      onSuccess: () => {
        setShowDeleteModal(false)
        navigate('/inventario/almacenes')
      },
      onError: (err: any) => {
        console.error('Error al eliminar almacén:', err)
      },
    })
  }

  const printers = warehouse.printers ?? []
  const responsableNombre =
    warehouse.responsable?.nombre ?? warehouse.responsable?.correo ?? 'Sin asignar'

  const filteredPrinters = printers.filter((p) => {
    const term = printerSearch.toLowerCase()
    const matchesSearch =
      !term ||
      String(p.id).toLowerCase().includes(term) ||
      (p.marca ?? '').toLowerCase().includes(term) ||
      (p.modelo ?? '').toLowerCase().includes(term) ||
      (p.num_serie ?? '').toLowerCase().includes(term)

    const matchesStatus =
      printerStatusFilter === 'all' || p.estado === printerStatusFilter

    return matchesSearch && matchesStatus
  })

  return (
    <PageLayout title={`Inventario › Almacenes › ${warehouse.nombre}`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/inventario/almacenes')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowDeleteModal(true)}
                disabled={printers.length > 0}
                title={
                  printers.length > 0
                    ? 'No se puede eliminar un almacén con impresoras asignadas'
                    : 'Eliminar almacén'
                }
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
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
                      <WarehouseIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{warehouse.nombre}</CardTitle>
                      <p className="text-sm text-muted-foreground">ID: {warehouse.id}</p>
                    </div>
                  </div>
                  <Badge variant={warehouse.activo ? 'success' : 'neutral'}>
                    {warehouse.activo ? 'ACTIVO' : 'INACTIVO'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Dirección</p>
                      <p className="text-foreground text-sm">{warehouse.direccion}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Responsable</p>
                      <p className="text-foreground text-sm">{responsableNombre}</p>
                    </div>
                  </div>
                  {warehouse.responsable?.telefono && (
                    <div className="flex items-start gap-2">
                      <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Teléfono</p>
                        <p className="text-foreground text-sm">
                          {warehouse.responsable.telefono}
                        </p>
                      </div>
                    </div>
                  )}
                  {warehouse.created_at && (
                    <div className="flex items-start gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Fecha de Creación</p>
                        <p className="text-foreground text-sm">{formatDate(warehouse.created_at)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Impresoras en este Almacén</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/inventario/impresoras')}
                  >
                    Ver todas las impresoras
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Buscar impresora..."
                        value={printerSearch}
                        onChange={(e) => setPrinterSearch(e.target.value)}
                        className="w-full rounded-md border border-input py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        aria-label="Buscar impresoras"
                      />
                    </div>
                    <select
                      value={printerStatusFilter}
                      onChange={(e) => setPrinterStatusFilter(e.target.value)}
                      className="rounded-md border border-input py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="all">Todos los estados</option>
                      <option value="EN_ALMACEN">En almacén</option>
                      <option value="RENTADA">Rentada</option>
                      <option value="EN_MANTENIMIENTO">En mantenimiento</option>
                      <option value="DADA_DE_BAJA">Dada de baja</option>
                    </select>
                  </div>

                  {printers.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">
                        No hay impresoras asignadas a este almacén.
                      </p>
                    </div>
                  ) : filteredPrinters.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">
                        No se encontraron impresoras con los filtros aplicados.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full divide-y divide-border bg-card">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                              ID
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                              Modelo
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                              Estado
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">
                              Contador
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">
                              Acciones
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {filteredPrinters.map((printer: any) => (
                            <tr
                              key={printer.id}
                              onClick={() =>
                                navigate(`/inventario/impresoras/${printer.id}`)
                              }
                              className="cursor-pointer transition-colors hover:bg-muted"
                            >
                              <td className="px-4 py-3 text-sm text-muted-foreground">
                                {printer.id}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <p className="font-medium text-foreground">
                                  {printer.marca} {printer.modelo}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Serie: {printer.num_serie}
                                </p>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <Badge variant="printer_status" color={printer.estado}>
                                  {String(printer.estado).replace(/_/g, ' ')}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-sm text-right tabular-nums text-muted-foreground">
                                {(printer.contador_actual ?? 0).toLocaleString('es-MX')}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    navigate(`/inventario/impresoras/${printer.id}`)
                                  }}
                                >
                                  Ver
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <WarehouseStats warehouse={warehouse} />
          </div>
        </div>
      </div>

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Editar Almacén"
        size="lg"
      >
        <WarehouseForm
          initialData={warehouse}
          onSubmit={handleEdit}
          onCancel={() => setShowEditModal(false)}
          isEdit
          loading={updateMutation.isPending}
        />
      </Modal>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Eliminar Almacén"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            ¿Estás seguro de que deseas eliminar el almacén{" "}
            <span className="font-semibold">{warehouse.nombre}</span>? Esta acción no se puede
            deshacer.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
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
