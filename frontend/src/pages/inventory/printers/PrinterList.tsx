import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Printer as PrinterIcon, Plus, MoreVertical } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { usePrinters } from '@/hooks/usePrinters'
import { formatCurrency, formatDate, getPrinterStatusColor } from '@/lib/formatters'
import { useIsAdmin } from '@/contexts/AuthContext'

export default function PrinterList() {
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const [page, setPage] = useState(1)
  const { data, isLoading, error } = usePrinters({ page, per_page: 25 })

  const printers = data?.data || []

  const columns = [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
    },
    {
      key: 'modelo',
      label: 'Modelo',
      sortable: true,
      render: (_value: string, row: any) => (
        <div>
          <p className="font-medium">{row.marca} {_value}</p>
          <p className="text-xs text-gray-500">SERIE: {row.num_serie}</p>
          <p className="text-xs text-gray-400">COSTO: {formatCurrency(row.costo_adquisicion ?? 0)}</p>
        </div>
      ),
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      render: (value: string) => (
        <Badge variant="printer_status" color={value}>
          {(value || '').replace(/_/g, ' ').toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'codigo_negocio',
      label: 'Ubicación',
      sortable: true,
      render: (_value: string, row: any) => (
        <div>
          <p>{row.codigo_negocio}</p>
          {row.warehouse && (
            <p className="text-xs text-gray-500">ALMACÉN: {row.warehouse.nombre || row.warehouse.id}</p>
          )}
        </div>
      ),
    },
    {
      key: 'contador_actual',
      label: 'Contador',
      sortable: true,
      render: (value: number) => (
        <span className="tabular-nums">{(value ?? 0).toLocaleString('es-MX')}</span>
      ),
    },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (_value: unknown, _row: any) => (
        <button className="p-1 hover:bg-gray-100 rounded">
          <MoreVertical className="h-4 w-4" />
        </button>
      ),
    },
  ]

  if (isLoading) {
    return (
      <PageLayout title="Inventario › Impresoras" showSearch>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Inventario › Impresoras" showSearch>
        <div className="flex items-center justify-center h-64">
          <p className="text-red-600">Error al cargar impresoras</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Inventario › Impresoras" showSearch>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Impresoras</h2>
            <p className="text-sm text-gray-500">Gestión de impresoras del negocio</p>
          </div>
          {isAdmin && (
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Impresora
            </Button>
          )}
        </div>

        <Table
          data={printers}
          columns={columns}
          searchable={true}
          sortable={true}
          paginatable={true}
          pageSize={25}
          currentPage={page}
          totalPages={data?.last_page || 1}
          onPageChange={setPage}
          emptyMessage="No hay impresoras registradas"
          onRowClick={(printer) => navigate(`/inventario/impresoras/${printer.id}`)}
        />
      </div>
    </PageLayout>
  )
}
