import { Eye, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import type { Warehouse } from '@/types/warehouse'

export interface WarehouseCardProps {
  warehouse: Warehouse
  onView?: (id: string) => void
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
}

export default function WarehouseCard({ warehouse, onView, onEdit, onDelete }: WarehouseCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-foreground">{warehouse.nombre}</h3>
            <p className="text-xs text-muted-foreground">{warehouse.direccion}</p>
          </div>
          <Badge variant={warehouse.activo ? 'success' : 'neutral'}>
            {warehouse.activo ? 'ACTIVO' : 'INACTIVO'}
          </Badge>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground mb-3">
          <p>
            <span className="font-medium text-muted-foreground">Responsable:</span>{' '}
            {warehouse.responsable?.nombre ?? warehouse.responsable?.correo ?? 'Sin asignar'}
          </p>
          {warehouse.responsable?.telefono && (
            <p>
              <span className="font-medium text-muted-foreground">Tel:</span>{' '}
              {warehouse.responsable.telefono}
            </p>
          )}
          <p>
            <span className="font-medium text-muted-foreground">Impresoras:</span>{' '}
            {warehouse.printers_count ?? 0}
          </p>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border">
          {onView && (
            <button
              onClick={() => onView(warehouse.id)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:bg-muted rounded"
              aria-label="Ver detalle"
            >
              <Eye className="h-3.5 w-3.5" />
              Ver
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(warehouse.id)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-muted-foreground hover:bg-muted rounded"
              aria-label="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(warehouse.id)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-destructive hover:bg-destructive/10 rounded"
              aria-label="Eliminar"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
