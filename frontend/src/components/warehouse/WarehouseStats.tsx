import { Warehouse as WarehouseIcon, Package } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import type { WarehouseDetail } from '@/types/warehouse'

export interface WarehouseStatsProps {
  warehouse: WarehouseDetail
}

export default function WarehouseStats({ warehouse }: WarehouseStatsProps) {
  const stats = [
    {
      label: 'Total Impresoras',
      value: warehouse.impresoras.length.toString(),
      icon: Package,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
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
  )
}
