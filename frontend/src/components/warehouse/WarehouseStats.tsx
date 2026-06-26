import { Warehouse as WarehouseIcon, Package } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import type { WarehouseDetail } from '@/types/warehouse'

export interface WarehouseStatsProps {
  warehouse: WarehouseDetail
}

export default function WarehouseStats({ warehouse }: WarehouseStatsProps) {
  const total = (warehouse.printers ?? []).length
  const stats = [
    {
      label: 'Total Impresoras',
      value: total.toString(),
      icon: Package,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Estado',
      value: warehouse.activo ? 'ACTIVO' : 'INACTIVO',
      icon: WarehouseIcon,
      color: warehouse.activo ? 'text-success' : 'text-muted-foreground',
      bg: warehouse.activo ? 'bg-success/10' : 'bg-muted',
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
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className={`text-lg font-semibold ${stat.color}`}>{stat.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
