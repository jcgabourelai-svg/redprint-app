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
            <h3 className="font-semibold text-gray-900">{warehouse.nombre}</h3>
            <p className="text-xs text-gray-500">{warehouse.direccion}</p>
          </div>
          <Badge variant={warehouse.estado === 'activo' ? 'success' : 'neutral'}>
            {warehouse.estado === 'activo' ? 'ACTIVO' : 'INACTIVO'}
          </Badge>
        </div>

        <div className="space-y-2 text-sm text-gray-600 mb-3">
          <p><span className="font-medium text-gray-700">Encargado:</span> {warehouse.encargado}</p>
          {warehouse.telefono && (
            <p><span className="font-medium text-gray-700">Tel:</span> {warehouse.telefono}</p>
          )}
          <p><span className="font-medium text-gray-700">Impresoras:</span> {warehouse.ocupacion_actual}</p>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          {onView && (
            <button
              onClick={() => onView(warehouse.id)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded"
              aria-label="Ver detalle"
            >
              <Eye className="h-3.5 w-3.5" />
              Ver
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(warehouse.id)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded"
              aria-label="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(warehouse.id)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded"
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
