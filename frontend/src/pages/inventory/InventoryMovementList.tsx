import { useState } from 'react'
import { useInventoryMovements } from '@/hooks/useInventoryMovements'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/EmptyState'
import { TablePagination } from '@/components/ui/TablePagination'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { MOVEMENT_TYPE_LABELS, MovementType } from '@/types/enums'
import { formatDate } from '@/lib/utils'
import type { InventoryMovement } from '@/types/models'

const movementBadgeVariant: Record<string, 'success' | 'error' | 'info'> = {
  ENTRADA: 'success',
  SALIDA: 'error',
  AJUSTE: 'info',
}

const typeOptions = [
  { value: '', label: 'Todos los tipos' },
  ...Object.values(MovementType).map((t) => ({
    value: t,
    label: MOVEMENT_TYPE_LABELS[t],
  })),
]

export default function InventoryMovementList() {
  const [page, setPage] = useState(1)
  const [tipoMovimiento, setTipoMovimiento] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const params: Record<string, string | number> = { page }
  if (tipoMovimiento) params.tipo_movimiento = tipoMovimiento
  if (fechaDesde) params.fecha_desde = fechaDesde
  if (fechaHasta) params.fecha_hasta = fechaHasta

  const { data, isLoading, isError, refetch } = useInventoryMovements(params)

  if (isLoading) {
    return <LoadingSpinner className="py-20" text="Cargando movimientos..." />
  }

  if (isError) {
    return <ErrorMessage message="Error al cargar los movimientos" onRetry={() => refetch()} />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Movimientos de Inventario</h1>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          options={typeOptions}
          value={tipoMovimiento}
          onChange={(e) => {
            setTipoMovimiento(e.target.value)
            setPage(1)
          }}
          className="w-full sm:w-48"
        />
        <Input
          label=""
          type="date"
          placeholder="Desde"
          value={fechaDesde}
          onChange={(e) => {
            setFechaDesde(e.target.value)
            setPage(1)
          }}
          className="w-full sm:w-44"
        />
        <Input
          label=""
          type="date"
          placeholder="Hasta"
          value={fechaHasta}
          onChange={(e) => {
            setFechaHasta(e.target.value)
            setPage(1)
          }}
          className="w-full sm:w-44"
        />
      </div>

      {!data?.data.length ? (
        <EmptyState title="Sin movimientos" description="No se encontraron movimientos con los filtros seleccionados" />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Articulo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead>Stock Anterior</TableHead>
                <TableHead>Stock Posterior</TableHead>
                <TableHead>Justificacion</TableHead>
                <TableHead>Socio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((movement: InventoryMovement) => (
                <TableRow key={movement.id}>
                  <TableCell>{formatDate(movement.fecha)}</TableCell>
                  <TableCell className="font-medium">{movement.article?.nombre ?? '-'}</TableCell>
                  <TableCell>
                    <Badge variant={movementBadgeVariant[movement.tipo_movimiento] ?? 'default'}>
                      {MOVEMENT_TYPE_LABELS[movement.tipo_movimiento as MovementType] ?? movement.tipo_movimiento}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{movement.cantidad}</TableCell>
                  <TableCell>{movement.stock_anterior}</TableCell>
                  <TableCell>{movement.stock_posterior}</TableCell>
                  <TableCell>{movement.justificacion ?? '-'}</TableCell>
                  <TableCell>{movement.socio?.nombre ?? '-'}</TableCell>
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
