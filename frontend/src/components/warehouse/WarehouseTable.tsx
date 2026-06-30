import Table from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import type { Warehouse } from '@/types/warehouse'

export interface WarehouseTableProps {
  warehouses: Warehouse[]
  onView?: (id: string) => void
  loading?: boolean
  emptyMessage?: string
}

export default function WarehouseTable({
  warehouses,
  onView,
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
          <p className="text-xs text-muted-foreground">ID: {row.id}</p>
        </div>
      ),
    },
    {
      key: 'direccion',
      label: 'Dirección',
      sortable: true,
      render: (value: string) => (
        <span className="text-sm text-muted-foreground max-w-[200px] truncate block">{value}</span>
      ),
    },
    {
      key: 'responsable',
      label: 'Responsable',
      sortable: false,
      render: (_value: unknown, row: Warehouse) => (
        <span className="text-sm text-muted-foreground">
          {row.responsable?.nombre ?? row.responsable?.correo ?? 'Sin asignar'}
        </span>
      ),
    },
    {
      key: 'printers_count',
      label: 'Impresoras',
      sortable: true,
      render: (_value: number, row: Warehouse) => (
        <span className="text-sm text-muted-foreground">{row.printers_count ?? 0}</span>
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
