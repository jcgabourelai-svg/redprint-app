import { Card, CardContent } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import type { Warehouse } from '@/types/warehouse'

export interface WarehouseCardProps {
  warehouse: Warehouse
  onView?: (id: string) => void
}

export default function WarehouseCard({ warehouse, onView }: WarehouseCardProps) {
  return (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-colors"
      onClick={() => onView?.(warehouse.id)}
    >
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
      </CardContent>
    </Card>
  )
}
