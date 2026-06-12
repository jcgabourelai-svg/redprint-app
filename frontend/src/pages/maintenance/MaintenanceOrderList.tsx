import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useMaintenanceOrders } from '@/hooks/useMaintenanceOrders'
import { usePrinters } from '@/hooks/usePrinters'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/EmptyState'
import { TablePagination } from '@/components/ui/TablePagination'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import {
  MaintenanceType,
  MaintenanceStatus,
  MAINTENANCE_TYPE_LABELS,
  MAINTENANCE_STATUS_LABELS,
} from '@/types/enums'
import type { MaintenanceOrder } from '@/types/models'
import { formatDate, formatCurrency } from '@/lib/utils'

const statusBadgeVariant: Record<string, 'warning' | 'success' | 'secondary'> = {
  PROGRAMADA: 'warning',
  COMPLETADA: 'success',
  CANCELADA: 'secondary',
}

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  ...Object.values(MaintenanceStatus).map((s) => ({
    value: s,
    label: MAINTENANCE_STATUS_LABELS[s as MaintenanceStatus],
  })),
]

const typeOptions = [
  { value: '', label: 'Todos los tipos' },
  ...Object.values(MaintenanceType).map((t) => ({
    value: t,
    label: MAINTENANCE_TYPE_LABELS[t],
  })),
]

export default function MaintenanceOrderList() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [estado, setEstado] = useState('')
  const [tipoMantto, setTipoMantto] = useState('')
  const [impresoraId, setImpresoraId] = useState('')

  const params: Record<string, string | number> = { page }
  if (estado) params.estado = estado
  if (tipoMantto) params.tipo_mantto = tipoMantto
  if (impresoraId) params.impresora_id = impresoraId

  const { data, isLoading, isError, refetch } = useMaintenanceOrders(params)
  const { data: printersData } = usePrinters({ page: 1, per_page: 100 })

  const printerOptions = [
    { value: '', label: 'Todas las impresoras' },
    ...(printersData?.data.map((p: { id: number; codigo_negocio: string; marca: string; modelo: string }) => ({
      value: String(p.id),
      label: `${p.codigo_negocio} - ${p.marca} ${p.modelo}`,
    })) ?? []),
  ]

  if (isLoading) {
    return <LoadingSpinner className="py-20" text="Cargando ordenes..." />
  }

  if (isError) {
    return <ErrorMessage message="Error al cargar las ordenes de mantenimiento" onRetry={() => refetch()} />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Ordenes de Mantenimiento</h1>
        <Button onClick={() => navigate('/mantenimiento/nueva')}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Orden
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          options={statusOptions}
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value)
            setPage(1)
          }}
          className="w-full sm:w-48"
        />
        <Select
          options={typeOptions}
          value={tipoMantto}
          onChange={(e) => {
            setTipoMantto(e.target.value)
            setPage(1)
          }}
          className="w-full sm:w-48"
        />
        <Select
          options={printerOptions}
          value={impresoraId}
          onChange={(e) => {
            setImpresoraId(e.target.value)
            setPage(1)
          }}
          className="w-full sm:w-64"
        />
      </div>

      {!data?.data.length ? (
        <EmptyState
          title="Sin ordenes"
          description="No se encontraron ordenes de mantenimiento con los filtros seleccionados"
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Impresora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Costo Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((order: MaintenanceOrder) => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/mantenimiento/${order.id}`)}
                >
                  <TableCell>{formatDate(order.fecha)}</TableCell>
                  <TableCell className="font-medium">
                    {order.printer
                      ? `${order.printer.codigo_negocio} - ${order.printer.marca} ${order.printer.modelo}`
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="info">
                      {MAINTENANCE_TYPE_LABELS[order.tipo_mantto as MaintenanceType] ?? order.tipo_mantto}
                    </Badge>
                  </TableCell>
                  <TableCell>{order.supplier?.razon_social ?? '-'}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant[order.estado] ?? 'secondary'}>
                      {MAINTENANCE_STATUS_LABELS[order.estado as MaintenanceStatus] ?? order.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(order.costo_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <TablePagination
            currentPage={data.current_page}
            totalPages={data.last_page}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}
