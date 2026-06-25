import { Eye, Pencil, Trash2 } from 'lucide-react'
import Table from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import type { Warehouse } from '@/types/warehouse'

export interface WarehouseTableProps {
  warehouses: Warehouse[]
  onEdit?: (id: string) => void
  onView?: (id: string) => void
  onDelete?: (id: string) => void
  loading?: boolean
  emptyMessage?: string
}

export default function WarehouseTable({
  warehouses,
  onEdit,
  onView,
  onDelete,
  emptyMessage = 'No hay almacenes registrados',
}: WarehouseTableProps) {
  const columns = [
    {
      key: 'nombre',
      label: 'Nombre',
      sortable: true,
      render: (value: string, row: Warehouse) => (
        <div>
          <p className="font-medium">{value}</p>
          <p className="text-xs text-gray-500">ID: {row.id}</p>
        </div>
      ),
    },
    {
      key: 'direccion',
      label: 'Dirección',
      sortable: true,
      render: (value: string) => (
        <span className="text-sm text-gray-600 max-w-[200px] truncate block">{value}</span>
      ),
    },
    {
      key: 'responsable',
      label: 'Responsable',
      sortable: false,
      render: (_value: unknown, row: Warehouse) => (
        <span className="text-sm text-gray-600">
          {row.responsable?.nombre ?? row.responsable?.correo ?? 'Sin asignar'}
        </span>
      ),
    },
    {
      key: 'printers_count',
      label: 'Impresoras',
      sortable: true,
      render: (_value: number, row: Warehouse) => (
        <span className="text-sm text-gray-600">{row.printers_count ?? 0}</span>
      ),
    },
    {
      key: 'activo',
      label: 'Estado',
      sortable: true,
      render: (value: boolean) => (
        <Badge variant={value ? 'success' : 'neutral'}>
          {value ? 'ACTIVO' : 'INACTIVO'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (_value: unknown, row: Warehouse) => (
        <div className="flex items-center gap-1">
          {onView && (
            <button
              onClick={(e) => { e.stopPropagation(); onView(row.id) }}
              className="p-1 hover:bg-gray-100 rounded"
              aria-label="Ver detalle"
            >
              <Eye className="h-4 w-4 text-gray-500" />
            </button>
          )}
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(row.id) }}
              className="p-1 hover:bg-gray-100 rounded"
              aria-label="Editar"
            >
              <Pencil className="h-4 w-4 text-gray-500" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(row.id) }}
              className="p-1 hover:bg-red-50 rounded"
              aria-label="Eliminar"
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <Table
      data={warehouses}
      columns={columns}
      searchable={false}
      sortable={true}
      paginatable={false}
      emptyMessage={emptyMessage}
      onRowClick={(row) => onView?.(row.id)}
    />
  )
}
