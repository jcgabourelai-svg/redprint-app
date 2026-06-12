import { useMaintenanceProviderMetrics } from '@/hooks/useMaintenanceReports'
import { Card, CardContent } from '@/components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { formatCurrency } from '@/lib/utils'
import { Wrench } from 'lucide-react'

interface ProviderMetric {
  proveedor: string
  total_ordenes: number
  costo_promedio: number
  costo_total: number
  dias_promedio_resolucion: number
}

export default function MaintenanceProviderReport() {
  const { data, isLoading, isError, refetch } = useMaintenanceProviderMetrics()

  if (isLoading) return <LoadingSpinner text="Cargando reporte de proveedores..." />
  if (isError) return <ErrorMessage message="Error al cargar reporte de proveedores" onRetry={() => refetch()} />
  if (!data) return null

  const providers: ProviderMetric[] = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reporte por Proveedor</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Metricas de mantenimiento agrupadas por proveedor
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Proveedores de Mantenimiento</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-right">Total Ordenes</TableHead>
                <TableHead className="text-right">Costo Promedio</TableHead>
                <TableHead className="text-right">Costo Total</TableHead>
                <TableHead className="text-right">Dias Prom. Resolucion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No hay datos disponibles
                  </TableCell>
                </TableRow>
              )}
              {providers.map((provider, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{provider.proveedor}</TableCell>
                  <TableCell className="text-right">{provider.total_ordenes}</TableCell>
                  <TableCell className="text-right">{formatCurrency(provider.costo_promedio)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(provider.costo_total)}</TableCell>
                  <TableCell className="text-right">{provider.dias_promedio_resolucion.toFixed(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
