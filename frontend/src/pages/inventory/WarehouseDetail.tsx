import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { PowerOff } from 'lucide-react'
import { useWarehouse, useCreateWarehouse } from '@/hooks/useWarehouses'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PRINTER_STATUS_LABELS } from '@/types/enums'

const statusBadgeVariant: Record<string, 'success' | 'info' | 'warning' | 'error'> = {
  EN_ALMACEN: 'info',
  RENTADA: 'success',
  EN_MANTENIMIENTO: 'warning',
  DADA_DE_BAJA: 'error',
}

export default function WarehouseDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { addToast } = useToast()
  const isAdmin = user?.rol === 'ADMIN'
  const warehouseId = Number(id)

  const [deactivateOpen, setDeactivateOpen] = useState(false)

  const { data: warehouse, isLoading, isError, refetch } = useWarehouse(warehouseId)
  const deactivateMutation = useCreateWarehouse()

  const printers = (warehouse as Record<string, unknown> & { printers?: Array<Record<string, unknown>> })?.printers ?? []

  const handleDeactivate = async () => {
    if (printers.length > 0) {
      addToast('No se puede desactivar un almacen con impresoras asignadas', 'error')
      return
    }
    try {
      await deactivateMutation.mutateAsync({ id: warehouseId, activo: false })
      addToast('Almacen desactivado correctamente', 'success')
      refetch()
    } catch {
      addToast('Error al desactivar el almacen', 'error')
    }
  }

  if (isLoading) {
    return <LoadingSpinner className="py-20" text="Cargando almacen..." />
  }

  if (isError || !warehouse) {
    return <ErrorMessage message="Error al cargar el almacen" onRetry={() => refetch()} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{warehouse.nombre}</h1>
          <p className="text-muted-foreground">{warehouse.direccion}</p>
        </div>
        {isAdmin && warehouse.activo && (
          <Button variant="destructive" onClick={() => setDeactivateOpen(true)}>
            <PowerOff className="mr-2 h-4 w-4" />
            Desactivar
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informacion del Almacen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Nombre</p>
              <p className="font-medium">{warehouse.nombre}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Direccion</p>
              <p className="font-medium">{warehouse.direccion}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Responsable</p>
              <p className="font-medium">{warehouse.responsable?.nombre ?? '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estado</p>
              <Badge variant={warehouse.activo ? 'success' : 'error'}>
                {warehouse.activo ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Impresoras</p>
              <p className="font-medium">{warehouse.printers_count ?? printers.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Impresoras en este Almacen</CardTitle>
        </CardHeader>
        <CardContent>
          {printers.length === 0 ? (
            <EmptyState title="Sin impresoras" description="No hay impresoras en este almacen" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codigo</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Contador</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {printers.map((printer) => (
                  <TableRow key={printer.id as number}>
                    <TableCell className="font-medium">{printer.codigo_negocio as string}</TableCell>
                    <TableCell>{printer.marca as string}</TableCell>
                    <TableCell>{printer.modelo as string}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant[printer.estado as string]}>
                        {PRINTER_STATUS_LABELS[printer.estado as keyof typeof PRINTER_STATUS_LABELS]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {(printer.contador_actual as number).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        onConfirm={handleDeactivate}
        title="Desactivar Almacen"
        message="¿Estas seguro de desactivar este almacen? Solo se puede desactivar si no tiene impresoras asignadas."
        confirmLabel="Desactivar"
        variant="destructive"
      />
    </div>
  )
}
