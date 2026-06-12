import { useProblematicPrinters } from '@/hooks/useMaintenanceReports'
import { Card, CardContent } from '@/components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

interface ProblematicPrinter {
  impresora_codigo: string
  impresora_marca: string
  impresora_modelo: string
  total_mantenimientos: number
  costo_total: number
  costo_promedio: number
}

export default function ProblematicPrintersReport() {
  const { data, isLoading, isError, refetch } = useProblematicPrinters(10)

  if (isLoading) return <LoadingSpinner text="Cargando reporte de impresoras problematicas..." />
  if (isError) return <ErrorMessage message="Error al cargar reporte" onRetry={() => refetch()} />
  if (!data) return null

  const printers: ProblematicPrinter[] = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Impresoras Problematicas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Top 10 impresoras con mas mantenimiento
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <h3 className="text-lg font-semibold">Top 10 Impresoras</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Codigo</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead className="text-right">Total Mantenimientos</TableHead>
                <TableHead className="text-right">Costo Total</TableHead>
                <TableHead className="text-right">Costo Promedio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {printers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No hay datos disponibles
                  </TableCell>
                </TableRow>
              )}
              {printers.map((printer, idx) => (
                <TableRow key={idx} className={idx < 3 ? 'bg-warning/5' : ''}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{idx + 1}</span>
                      {idx < 3 && <Badge variant="warning">Top {idx + 1}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{printer.impresora_codigo}</TableCell>
                  <TableCell>{printer.impresora_marca}</TableCell>
                  <TableCell>{printer.impresora_modelo}</TableCell>
                  <TableCell className="text-right">{printer.total_mantenimientos}</TableCell>
                  <TableCell className="text-right">{formatCurrency(printer.costo_total)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(printer.costo_promedio)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
