import { useNavigate } from 'react-router-dom'
import { Plus, Wrench } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Table from '@/components/ui/Table'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import api from '@/lib/api'
import { useServerTable } from '@/hooks/useServerTable'
import { formatDate, formatCurrency, getMaintenanceStatusColor } from '@/lib/formatters'
import { problemTypeLabels, severityLabels, severityBadgeVariant } from '@/lib/maintenanceProblem'
import { useIsAdmin } from '@/contexts/AuthContext'
import type { MaintenanceOrder } from '@/types/maintenance-order'

export default function MaintenanceList() {
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const { data: orders, tableProps, isLoading, error, hasActiveFilters } = useServerTable<MaintenanceOrder>({
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
      key: 'tipo_problema',
      label: 'Problema',
      sortable: true,
      render: (_value: string, row: any) => {
        if (!row.tipo_problema && !row.severidad) {
          return <span className="text-muted-foreground">-</span>
        }
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {row.tipo_problema && (
              <span className="text-sm">
                {problemTypeLabels[row.tipo_problema] ?? row.tipo_problema}
              </span>
            )}
            {row.severidad && (
              <Badge
                variant={severityBadgeVariant(row.severidad)}
                className={row.severidad === 'CRITICA' ? 'ring-2 ring-red-300' : ''}
              >
                {severityLabels[row.severidad] ?? row.severidad}
              </Badge>
            )}
          </div>
        )
      },
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

        {orders.length === 0 && !hasActiveFilters ? (
          <EmptyState
            icon={Wrench}
            title="No hay órdenes de mantenimiento"
            description="Crea una orden para registrar el mantenimiento de una impresora."
            action={
              isAdmin
                ? { label: 'Nueva Orden', onClick: () => navigate('/inventario/mantenimiento/crear') }
                : undefined
            }
          />
        ) : (
          <Table
            data={orders}
            columns={columns}
            searchable={true}
            sortable={true}
            paginatable={true}
            {...tableProps}
            emptyMessage="No se encontraron órdenes de mantenimiento con los filtros aplicados."
            onRowClick={(order) => navigate(`/inventario/mantenimiento/${order.id}`)}
          />
        )}
      </div>
    </PageLayout>
  )
}
