import { useState } from 'react'
import { Plus, ArrowLeftRight, ArrowDown, ArrowUp, Eye, Trash2 } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { Card, CardContent } from '@/components/ui/Card'
import { useInventoryMovements } from '@/hooks/useInventoryMovements'
import { useWarehouses } from '@/hooks/useWarehouses'
import { useArticles } from '@/hooks/useArticles'
import { useUsers } from '@/hooks/useUsers'
import { formatDate, getMovementTypeColor } from '@/lib/formatters'
import type { InventoryMovement } from '@/types/inventory-movement'

const motivosEntrada: { value: string; label: string }[] = [
  { value: 'compra', label: 'Compra' },
  { value: 'devolucion', label: 'Devolución' },
  { value: 'ajuste', label: 'Ajuste de inventario' },
  { value: 'traslado', label: 'Traslado' },
]

const motivosSalida: { value: string; label: string }[] = [
  { value: 'consumo', label: 'Consumo' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'venta', label: 'Venta' },
  { value: 'traslado', label: 'Traslado' },
  { value: 'perdida', label: 'Pérdida' },
  { value: 'ajuste', label: 'Ajuste de inventario' },
]

const motivoLabels: Record<string, string> = {
  compra: 'Compra',
  devolucion: 'Devolución',
  ajuste: 'Ajuste',
  traslado: 'Traslado',
  consumo: 'Consumo',
  mantenimiento: 'Mantenimiento',
  venta: 'Venta',
  perdida: 'Pérdida',
}

export default function MovementList() {
  const [page, setPage] = useState(1)
  const { data, isLoading, error } = useInventoryMovements({ page, per_page: 10 })
  const { data: warehousesData } = useWarehouses({ per_page: 100 })
  const { data: articlesData } = useArticles({ per_page: 100 })
  const { data: usersData } = useUsers()
  const [tipoFilter, setTipoFilter] = useState('')
  const [almacenFilter, setAlmacenFilter] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')
  const [showNewMovement, setShowNewMovement] = useState(false)
  const [movementForm, setMovementForm] = useState({
    tipo: 'ENTRADA' as 'ENTRADA' | 'SALIDA',
    articulo_id: '',
    almacen_id: '',
    cantidad: 1,
    motivo: '',
    costo_unitario: 0,
    referencia: '',
    responsable: '',
    notas: '',
  })

  const movements = data?.data || []

  const almacenes = (warehousesData?.data || []).map((w: any) => ({
    value: String(w.id),
    label: w.nombre || `Almacén ${w.id}`,
  }))

  const articulos = (articlesData?.data || []).map((a: any) => ({
    value: String(a.id),
    label: a.nombre || a.descripcion || `Artículo ${a.id}`,
  }))

  const responsables = (usersData?.data || []).map((u: any) => ({
    value: u.nombre || u.correo || String(u.id),
    label: u.nombre || u.correo || `Usuario ${u.id}`,
  }))

  const filteredMovements = movements
    .filter((m) => (!tipoFilter || m.tipo === tipoFilter))
    .filter((m) => (!almacenFilter || m.almacen_id === almacenFilter))
    .filter((m) => (!estadoFilter || m.estado === estadoFilter))

  const totalMovements = movements.length
  const entradasMes = movements.filter((m) => m.tipo === 'ENTRADA').length
  const salidasMes = movements.filter((m) => m.tipo === 'SALIDA').length

  const motivosActivos = movementForm.tipo === 'ENTRADA' ? motivosEntrada : motivosSalida

  const columns = [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
    },
    {
      key: 'articulo_nombre',
      label: 'Artículo',
      sortable: true,
      render: (_value: string, row: InventoryMovement) => (
        <div>
          <p className="font-medium text-gray-900">{row.articulo_nombre}</p>
          <p className="text-xs text-gray-500">{row.articulo_id}</p>
        </div>
      ),
    },
    {
      key: 'tipo',
      label: 'Tipo',
      sortable: true,
      render: (value: string) => (
        <Badge variant={value === 'ENTRADA' ? 'success' : 'warning'}>
          {value === 'ENTRADA' ? 'ENTRADA' : 'SALIDA'}
        </Badge>
      ),
    },
    {
      key: 'almacen_nombre',
      label: 'Almacén',
      sortable: true,
      render: (_value: string, row: InventoryMovement) => (
        <div>
          <p className="text-sm">{row.almacen_nombre}</p>
          <p className="text-xs text-gray-400">{row.almacen_id}</p>
        </div>
      ),
    },
    {
      key: 'cantidad',
      label: 'Cantidad',
      sortable: true,
      render: (value: number) => (
        <span className="font-medium">{value} uds</span>
      ),
    },
    {
      key: 'motivo',
      label: 'Motivo',
      sortable: true,
      render: (value: string) => motivoLabels[value] || value,
    },
    {
      key: 'fecha',
      label: 'Fecha',
      sortable: true,
      render: (value: string) => formatDate(value),
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      render: (value: string) => {
        const variantMap: Record<string, 'success' | 'neutral' | 'error'> = {
          completado: 'success',
          pendiente: 'neutral',
          cancelado: 'error',
        }
        const labelMap: Record<string, string> = {
          completado: 'Completado',
          pendiente: 'Pendiente',
          cancelado: 'Cancelado',
        }
        return (
          <Badge variant={variantMap[value] || 'neutral'}>
            {labelMap[value] || value}
          </Badge>
        )
      },
    },
    {
      key: 'responsable',
      label: 'Responsable',
      sortable: true,
    },
    {
      key: 'acciones',
      label: 'Acciones',
      render: () => (
        <div className="flex items-center gap-1">
          <button className="p-1 hover:bg-gray-100 rounded" title="Ver detalle">
            <Eye className="h-4 w-4 text-gray-500" />
          </button>
          <button className="p-1 hover:bg-gray-100 rounded" title="Eliminar">
            <Trash2 className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <PageLayout title="Inventario › Movimientos" showSearch>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Inventario › Movimientos" showSearch>
        <div className="flex items-center justify-center h-64">
          <p className="text-red-600">Error al cargar movimientos</p>
        </div>
      </PageLayout>
    )
  }

  const hasFilters = tipoFilter || almacenFilter || estadoFilter
  const clearFilters = () => {
    setTipoFilter('')
    setAlmacenFilter('')
    setEstadoFilter('')
  }

  return (
    <PageLayout title="Inventario › Movimientos" showSearch>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Movimientos de Inventario</h2>
            <p className="text-sm text-gray-500">Registro de entradas y salidas de artículos</p>
          </div>
          <Button onClick={() => setShowNewMovement(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Movimiento
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 p-2">
                  <ArrowLeftRight className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Movimientos</p>
                  <p className="text-lg font-bold">{totalMovements}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-50 p-2">
                  <ArrowDown className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Entradas</p>
                  <p className="text-lg font-bold text-green-600">{entradasMes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-50 p-2">
                  <ArrowUp className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Salidas</p>
                  <p className="text-lg font-bold text-amber-600">{salidasMes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-44">
            <Select
              options={[
                { value: '', label: 'Todos los tipos' },
                { value: 'ENTRADA', label: 'Entrada' },
                { value: 'SALIDA', label: 'Salida' },
              ]}
              value={tipoFilter}
              onChange={setTipoFilter}
              placeholder="Filtrar por tipo"
            />
          </div>
          <div className="w-52">
            <Select
              options={[
                { value: '', label: 'Todos los almacenes' },
                ...almacenes,
              ]}
              value={almacenFilter}
              onChange={setAlmacenFilter}
              placeholder="Filtrar por almacén"
            />
          </div>
          <div className="w-44">
            <Select
              options={[
                { value: '', label: 'Todos los estados' },
                { value: 'completado', label: 'Completado' },
                { value: 'pendiente', label: 'Pendiente' },
                { value: 'cancelado', label: 'Cancelado' },
              ]}
              value={estadoFilter}
              onChange={setEstadoFilter}
              placeholder="Filtrar por estado"
            />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          )}
        </div>

        <Table
          data={filteredMovements}
          columns={columns}
          searchable={true}
          sortable={true}
          paginatable={true}
          pageSize={10}
          currentPage={page}
          totalPages={data?.last_page || 1}
          onPageChange={setPage}
          emptyMessage="No hay movimientos registrados"
        />

        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Entradas: <strong className="text-green-600">{entradasMes}</strong> | Salidas: <strong className="text-amber-600">{salidasMes}</strong>
          </span>
          <span>Mostrando {filteredMovements.length} de {movements.length} movimientos</span>
        </div>
      </div>

      <Modal
        isOpen={showNewMovement}
        onClose={() => setShowNewMovement(false)}
        title="Registrar Movimiento"
        size="lg"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de movimiento *</label>
            <Select
              options={[
                { value: 'ENTRADA', label: 'Entrada' },
                { value: 'SALIDA', label: 'Salida' },
              ]}
              value={movementForm.tipo}
              onChange={(v) => setMovementForm({ ...movementForm, tipo: v as 'ENTRADA' | 'SALIDA', motivo: '' })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Artículo *</label>
              <Select
                options={articulos}
                value={movementForm.articulo_id}
                onChange={(v) => setMovementForm({ ...movementForm, articulo_id: v })}
                placeholder="Seleccionar artículo"
                searchable
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {movementForm.tipo === 'ENTRADA' ? 'Almacén destino' : 'Almacén origen'} *
              </label>
              <Select
                options={almacenes}
                value={movementForm.almacen_id}
                onChange={(v) => setMovementForm({ ...movementForm, almacen_id: v })}
                placeholder="Seleccionar almacén"
                searchable
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad *</label>
              <Input
                type="number"
                value={movementForm.cantidad}
                onChange={(e) => setMovementForm({ ...movementForm, cantidad: Number(e.target.value) })}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo *</label>
              <Select
                options={motivosActivos}
                value={movementForm.motivo}
                onChange={(v) => setMovementForm({ ...movementForm, motivo: v })}
                placeholder="Seleccionar motivo"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Costo unitario</label>
              <Input
                type="number"
                value={movementForm.costo_unitario}
                onChange={(e) => setMovementForm({ ...movementForm, costo_unitario: Number(e.target.value) })}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Referencia</label>
              <Input
                value={movementForm.referencia}
                onChange={(e) => setMovementForm({ ...movementForm, referencia: e.target.value })}
                placeholder="CMP-001, FAC-045..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Responsable *</label>
            <Select
              options={responsables}
              value={movementForm.responsable}
              onChange={(v) => setMovementForm({ ...movementForm, responsable: v })}
              placeholder="Seleccionar responsable"
              searchable
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              value={movementForm.notas}
              onChange={(e) => setMovementForm({ ...movementForm, notas: e.target.value })}
              placeholder="Notas adicionales..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowNewMovement(false)}>Cancelar</Button>
            <Button onClick={() => setShowNewMovement(false)}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}
