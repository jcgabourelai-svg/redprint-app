import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { useMaintenanceOrders } from '@/hooks/useMaintenanceOrders'
import { formatDate, formatCurrency, getMaintenanceStatusColor } from '@/lib/formatters'
import { useIsAdmin } from '@/contexts/AuthContext'

export default function MaintenanceList() {
  const [page, setPage] = useState(1)
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const { data, isLoading, error } = useMaintenanceOrders({ page, per_page: 25 })

  const orders = data?.data || []

  const columns = [
    {
      key: 'id',
      label: 'Orden',
      sortable: true,
    },
    {
      key: 'impresora_marca',
      label: 'Impresora',
      sortable: true,
      render: (_value: string, row: any) => (
        <div>
          <p className="font-medium">{row.impresora_marca} {row.impresora_modelo}</p>
          <p className="text-xs text-gray-500">{row.socio_responsable}</p>
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
      key: 'tipo',
      label: 'Tipo',
      sortable: true,
      render: (value: string) => (
        <Badge variant={value === 'preventivo' ? 'primary' : 'warning'}>
          {value === 'preventivo' ? 'PREVENTIVO' : 'CORRECTIVO'}
        </Badge>
      ),
    },
    {
      key: 'descripcion',
      label: 'Descripción',
      render: (value: string) => (
        <p className="text-sm text-gray-700 max-w-xs truncate">{value}</p>
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
            className="p-1 hover:bg-gray-100 rounded"
            title="Ver detalle"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/inventario/mantenimiento/${row.id}`)
            }}
          >
            <Eye className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <PageLayout title="Inventario › Mantenimiento" showSearch>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Inventario › Mantenimiento" showSearch>
        <div className="flex items-center justify-center h-64">
          <p className="text-red-600">Error al cargar órdenes de mantenimiento</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Inventario › Mantenimiento" showSearch>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Órdenes de Mantenimiento</h2>
            <p className="text-sm text-gray-500">Gestión de servicios de mantenimiento</p>
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
          pageSize={25}
          currentPage={page}
          totalPages={data?.last_page || 1}
          onPageChange={setPage}
          emptyMessage="No hay órdenes de mantenimiento"
          onRowClick={(order) => navigate(`/inventario/mantenimiento/${order.id}`)}
        />
      </div>
    </PageLayout>
  )
}
