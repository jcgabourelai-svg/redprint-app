import { useNavigate } from 'react-router-dom'
import { Plus, Eye } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import api from '@/lib/api'
import { useServerTable } from '@/hooks/useServerTable'
import { formatDate, formatCurrency, getMaintenanceStatusColor } from '@/lib/formatters'
import { useIsAdmin } from '@/contexts/AuthContext'
import type { MaintenanceOrder } from '@/types/maintenance-order'

export default function MaintenanceList() {
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const { data: orders, tableProps, isLoading, error } = useServerTable<MaintenanceOrder>({
    queryKey: ['maintenance-orders'],
    fetcher: (p) => api.get('/maintenance-orders', { params: p }).then((r) => r.data),
    defaultSort: { column: 'fecha', dir: 'desc' },
  })

  const columns = [
    {
      key: 'id',
      label: 'Orden',
      sortable: true,
    },
    {
      key: 'impresora_id',
      label: 'Impresora',
      sortable: true,
      render: (_value: string, row: any) => (
        <div>
          <p className="font-medium">{row.printer?.marca} {row.printer?.modelo}</p>
          <p className="text-xs text-muted-foreground">{row.socio?.nombre}</p>
        </div>
      ),
    },
    {
      key: 'fecha',
      label: 'Fecha',
      sortable: true,
      render: (value: string) => formatDate(value),
    },
    {
      key: 'tipo_mantto',
      label: 'Tipo',
      sortable: true,
      render: (value: string) => (
        <Badge variant={value === 'PREVENTIVO' ? 'primary' : 'warning'}>
          {value === 'PREVENTIVO' ? 'PREVENTIVO' : 'CORRECTIVO'}
        </Badge>
      ),
    },
    {
      key: 'desc_problema',
      label: 'Descripción',
      render: (value: string) => (
        <p className="text-sm text-muted-foreground max-w-xs truncate">{value || '-'}</p>
      ),
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      render: (value: string) => (
        <Badge variant="document_status" color={value}>
          {value.replace(/_/g, ' ').toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'costo_mano_obra',
      label: 'Costo',
      sortable: true,
      render: (value: number) => formatCurrency(value),
    },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (_value: unknown, row: any) => (
        <div className="flex items-center gap-1">
          <button
            className="p-1 hover:bg-muted rounded"
            title="Ver detalle"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/inventario/mantenimiento/${row.id}`)
            }}
          >
            <Eye className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <PageLayout title="Inventario › Mantenimiento" showSearch>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Inventario › Mantenimiento" showSearch>
        <div className="flex items-center justify-center h-64">
          <p className="text-destructive">Error al cargar órdenes de mantenimiento</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Inventario › Mantenimiento" showSearch>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Órdenes de Mantenimiento</h2>
            <p className="text-sm text-muted-foreground">Gestión de servicios de mantenimiento</p>
          </div>
          {isAdmin && (
            <Button onClick={() => navigate('/inventario/mantenimiento/crear')}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Orden
            </Button>
          )}
        </div>

        <Table
          data={orders}
          columns={columns}
          searchable={true}
          sortable={true}
          paginatable={true}
          {...tableProps}
          emptyMessage="No hay órdenes de mantenimiento"
          onRowClick={(order) => navigate(`/inventario/mantenimiento/${order.id}`)}
        />
      </div>
    </PageLayout>
  )
}
