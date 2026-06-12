import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Filter, X, Warehouse as WarehouseIcon } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import WarehouseTable from '@/components/warehouse/WarehouseTable'
import WarehouseCard from '@/components/warehouse/WarehouseCard'
import WarehouseForm from '@/components/warehouse/WarehouseForm'
import { useWarehouses, useCreateWarehouse } from '@/hooks/useWarehouses'
import { useIsAdmin } from '@/contexts/AuthContext'


type OccupationFilter = 'all' | 'baja' | 'media' | 'alta' | 'llena'

function getOccupationLevel(warehouse: Warehouse): OccupationFilter {
  const pct = Math.round((warehouse.ocupacion_actual / warehouse.capacidad) * 100)
  if (pct <= 30) return 'baja'
  if (pct <= 70) return 'media'
  if (pct <= 90) return 'alta'
  return 'llena'
}

export default function WarehouseList() {
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | 'all'>('all')
  const [encargadoFilter, setEncargadoFilter] = useState<string>('all')
  const [occupationFilter, setOccupationFilter] = useState<OccupationFilter>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 25

  const { data, isLoading, error } = useWarehouses({ page: currentPage, per_page: pageSize })
  const createMutation = useCreateWarehouse()

  const warehouses = data?.data || []

  const encargados = useMemo(
    () => [...new Set(warehouses.map((w) => w.encargado))].sort(),
    [warehouses]
  )

  const filtered = useMemo(() => {
    return warehouses.filter((w) => {
      const term = searchTerm.toLowerCase()
      const matchesSearch =
        !term ||
        w.nombre.toLowerCase().includes(term) ||
        w.direccion.toLowerCase().includes(term) ||
        w.encargado.toLowerCase().includes(term) ||
        w.id.toLowerCase().includes(term)

      const matchesStatus = statusFilter === 'all' || w.estado === statusFilter
      const matchesEncargado = encargadoFilter === 'all' || w.encargado === encargadoFilter
      const matchesOccupation =
        occupationFilter === 'all' || getOccupationLevel(w) === occupationFilter

      return matchesSearch && matchesStatus && matchesEncargado && matchesOccupation
    })
  }, [warehouses, searchTerm, statusFilter, encargadoFilter, occupationFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginated = filtered.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  )

  const handleView = useCallback(
    (id: string) => navigate(`/inventario/almacenes/${id}`),
    [navigate]
  )

  const handleEdit = useCallback(
    (id: string) => navigate(`/inventario/almacenes/${id}`),
    [navigate]
  )

  const handleDelete = useCallback(
    (id: string) => setShowDeleteModal(id),
    []
  )

  const confirmDelete = useCallback(() => {
    if (!showDeleteModal) return
    setShowDeleteModal(null)
  }, [showDeleteModal])

  const handleCreate = useCallback(
    (data: WarehouseFormData) => {
      createMutation.mutate(data)
      setShowCreateModal(false)
    },
    [createMutation]
  )

  const clearFilters = useCallback(() => {
    setSearchTerm('')
    setStatusFilter('all')
    setEncargadoFilter('all')
    setOccupationFilter('all')
  }, [])

  const hasActiveFilters =
    statusFilter !== 'all' || encargadoFilter !== 'all' || occupationFilter !== 'all'

  if (isLoading) {
    return (
      <PageLayout title="Inventario › Almacenes">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Inventario › Almacenes">
        <div className="flex items-center justify-center h-64">
          <p className="text-red-600">Error al cargar almacenes</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Inventario › Almacenes">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Almacenes</h2>
            <p className="text-sm text-gray-500">
              Gestión de almacenes y ubicaciones de impresoras
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Almacén
            </Button>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, dirección, encargado..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Buscar almacenes"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filtros
              {hasActiveFilters && (
                <span className="ml-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs text-white">
                  !
                </span>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value as string | 'all')
                      setCurrentPage(1)
                    }}
                    className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Todos</option>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Encargado</label>
                  <select
                    value={encargadoFilter}
                    onChange={(e) => {
                      setEncargadoFilter(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Todos</option>
                    {encargados.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ocupación</label>
                  <select
                    value={occupationFilter}
                    onChange={(e) => {
                      setOccupationFilter(e.target.value as OccupationFilter)
                      setCurrentPage(1)
                    }}
                    className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Todos</option>
                    <option value="baja">Baja (&lt; 30%)</option>
                    <option value="media">Media (30% - 70%)</option>
                    <option value="alta">Alta (71% - 90%)</option>
                    <option value="llena">Llena (&gt; 90%)</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="mr-1 h-3 w-3" />
                    Limpiar filtros
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {warehouses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <WarehouseIcon className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No hay almacenes</h3>
            <p className="text-sm text-gray-500 mb-4">
              Comienza creando tu primer almacén para gestionar las ubicaciones de impresoras.
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Crear Almacén
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">Sin resultados</h3>
            <p className="text-sm text-gray-500 mb-4">
              No se encontraron almacenes con los filtros aplicados.
            </p>
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <WarehouseTable
                warehouses={paginated}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </div>
            <div className="md:hidden space-y-4">
              {paginated.map((w) => (
                <WarehouseCard
                  key={w.id}
                  warehouse={w}
                  onView={handleView}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Mostrando {(safeCurrentPage - 1) * pageSize + 1} a{' '}
                  {Math.min(safeCurrentPage * pageSize, filtered.length)} de {filtered.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safeCurrentPage === 1}
                  >
                    Anterior
                  </Button>
                  <span className="px-3 py-1 text-sm text-gray-600">
                    {safeCurrentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage === totalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nuevo Almacén"
        size="lg"
      >
        <WarehouseForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>

      <Modal
        isOpen={!!showDeleteModal}
        onClose={() => setShowDeleteModal(null)}
        title="Eliminar Almacén"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            ¿Estás seguro de que deseas eliminar este almacén? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" size="sm" onClick={() => setShowDeleteModal(null)}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDelete}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}
