import { Warehouse as WarehouseIcon, Package, BarChart3 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import ProgressBar from '@/components/ui/ProgressBar'
import type { WarehouseDetail } from '@/types/warehouse'

export interface WarehouseStatsProps {
  warehouse: WarehouseDetail
}

function getOccupationColor(pct: number): 'success' | 'warning' | 'error' {
  if (pct <= 30) return 'success'
  if (pct <= 70) return 'warning'
  return 'error'
}

function getOccupationLabel(pct: number): string {
  if (pct <= 30) return 'Baja'
  if (pct <= 70) return 'Media'
  if (pct <= 90) return 'Alta'
  return 'Llena'
}

export default function WarehouseStats({ warehouse }: WarehouseStatsProps) {
  const pct = warehouse.porcentaje_ocupacion

  const stats = [
    {
      label: 'Total Impresoras',
      value: warehouse.impresoras.length.toString(),
      icon: Package,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Ocupación',
      value: `${pct}%`,
      icon: BarChart3,
      color: pct <= 30 ? 'text-green-600' : pct <= 70 ? 'text-amber-600' : 'text-red-600',
      bg: pct <= 30 ? 'bg-green-50' : pct <= 70 ? 'bg-amber-50' : 'bg-red-50',
    },
    {
      label: 'Disponibilidad',
      value: `${warehouse.disponibilidad} espacios`,
      icon: WarehouseIcon,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Estado',
      value: warehouse.estado === 'activo' ? 'ACTIVO' : 'INACTIVO',
      icon: WarehouseIcon,
      color: warehouse.estado === 'activo' ? 'text-green-600' : 'text-gray-600',
      bg: warehouse.estado === 'activo' ? 'bg-green-50' : 'bg-gray-50',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <p className={`text-lg font-semibold ${stat.color}`}>{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Nivel de ocupación</span>
            <div className="flex items-center gap-2">
              <Badge variant={getOccupationColor(pct)}>
                {getOccupationLabel(pct)}
              </Badge>
              <span className="text-sm font-semibold text-gray-600">{pct}%</span>
            </div>
          </div>
          <ProgressBar
            value={pct}
            max={100}
            color={getOccupationColor(pct)}
            size="md"
            showLabel
          />
          <p className="mt-2 text-xs text-gray-500">
            {warehouse.ocupacion_actual} de {warehouse.capacidad} espacios utilizados
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
