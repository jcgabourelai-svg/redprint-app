import { Eye, Pencil, Trash2 } from 'lucide-react'
import Table from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import ProgressBar from '@/components/ui/ProgressBar'
import type { Warehouse } from '@/types/warehouse'

export interface WarehouseTableProps {
  warehouses: Warehouse[]
  onEdit?: (id: string) => void
  onView?: (id: string) => void
  onDelete?: (id: string) => void
  loading?: boolean
  emptyMessage?: string
}

function getOccupationColor(percentage: number): 'success' | 'warning' | 'error' {
  if (percentage <= 30) return 'success'
  if (percentage <= 70) return 'warning'
  return 'error'
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
      key: 'encargado',
      label: 'Encargado',
      sortable: true,
    },
    {
      key: 'capacidad',
      label: 'Capacidad',
      sortable: true,
      render: (_value: number, row: Warehouse) => (
        <span>{row.ocupacion_actual} / {row.capacidad}</span>
      ),
    },
    {
      key: 'ocupacion_actual',
      label: 'Ocupación',
      sortable: true,
      render: (_value: number, row: Warehouse) => {
        const pct = Math.round((row.ocupacion_actual / row.capacidad) * 100)
        return (
          <div className="flex items-center gap-2 min-w-[120px]">
            <ProgressBar
              value={pct}
              max={100}
              color={getOccupationColor(pct)}
              size="sm"
              className="flex-1"
            />
            <span className="text-xs font-medium text-gray-600 tabular-nums w-10 text-right">{pct}%</span>
          </div>
        )
      },
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      render: (value: string) => (
        <Badge variant={value === 'activo' ? 'success' : 'neutral'}>
          {value === 'activo' ? 'ACTIVO' : 'INACTIVO'}
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
