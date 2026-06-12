import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useWarehouses, useCreateWarehouse } from '@/hooks/useWarehouses'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/EmptyState'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import type { Warehouse } from '@/types/models'

export default function WarehouseList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addToast } = useToast()
  const isAdmin = user?.rol === 'ADMIN'

  const [createOpen, setCreateOpen] = useState(false)
  const [formNombre, setFormNombre] = useState('')
  const [formDireccion, setFormDireccion] = useState('')
  const [formResponsable, setFormResponsable] = useState('')

  const { data, isLoading, isError, refetch } = useWarehouses()
  const createWarehouse = useCreateWarehouse()

  const handleCreate = async () => {
    try {
      const payload: Record<string, unknown> = {
        nombre: formNombre,
        direccion: formDireccion,
      }
      if (formResponsable) payload.responsable_id = Number(formResponsable)

      await createWarehouse.mutateAsync(payload)
      addToast('Almacen creado correctamente', 'success')
      setCreateOpen(false)
      setFormNombre('')
      setFormDireccion('')
      setFormResponsable('')
      refetch()
    } catch {
      addToast('Error al crear el almacen', 'error')
    }
  }

  if (isLoading) {
    return <LoadingSpinner className="py-20" text="Cargando almacenes..." />
  }

  if (isError) {
    return <ErrorMessage message="Error al cargar los almacenes" onRetry={() => refetch()} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Almacenes</h1>
        {isAdmin && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Almacen
          </Button>
        )}
      </div>

      {!data?.data.length ? (
        <EmptyState title="Sin almacenes" description="No hay almacenes registrados" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Direccion</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead className="text-right">Activos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.map((warehouse: Warehouse) => (
              <TableRow
                key={warehouse.id}
                className="cursor-pointer"
                onClick={() => navigate(`/almacenes/${warehouse.id}`)}
              >
                <TableCell className="font-medium">{warehouse.nombre}</TableCell>
                <TableCell>{warehouse.direccion}</TableCell>
                <TableCell>{warehouse.responsable?.nombre ?? '-'}</TableCell>
                <TableCell className="text-right">{warehouse.printers_count ?? 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nuevo Almacen"
      >
        <div className="space-y-4">
          <Input
            id="wh-nombre"
            label="Nombre"
            value={formNombre}
            onChange={(e) => setFormNombre(e.target.value)}
          />
          <Input
            id="wh-direccion"
            label="Direccion"
            value={formDireccion}
            onChange={(e) => setFormDireccion(e.target.value)}
          />
          <Input
            id="wh-responsable"
            label="ID Responsable"
            type="number"
            value={formResponsable}
            onChange={(e) => setFormResponsable(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              loading={createWarehouse.isPending}
              disabled={!formNombre}
            >
              Crear Almacen
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
