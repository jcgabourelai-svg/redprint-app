import { useState } from 'react'
import { usePrinters } from '@/hooks/usePrinters'
import { usePrinterMaintenanceCost } from '@/hooks/useMaintenanceReports'
import { Card, CardContent } from '@/components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { formatCurrency } from '@/lib/utils'
import { DollarSign, Calculator } from 'lucide-react'

interface MonthlyBreakdown {
  mes: string
  total_mantenimientos: number
  costo_mantenimiento: number
  costo_gastos: number
  costo_total: number
}

interface PrinterCostData {
  impresora_codigo: string
  impresora_marca: string
  impresora_modelo: string
  total_mantenimientos: number
  costo_mantenimiento: number
  costo_gastos: number
  costo_total: number
  costo_promedio_por_orden: number
  desglose_mensual: MonthlyBreakdown[]
}

export default function PrinterMaintenanceCostPage() {
  const [selectedPrinterId, setSelectedPrinterId] = useState<number>(0)
  const { data: printersData, isLoading: printersLoading } = usePrinters({ per_page: 100 })
  const { data: costData, isLoading: costLoading, isError, refetch } = usePrinterMaintenanceCost(selectedPrinterId)

  if (printersLoading) return <LoadingSpinner text="Cargando impresoras..." />

  const printers = printersData?.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Costo de Mantenimiento por Impresora</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Detalle de costos de mantenimiento y gastos de una impresora
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <label className="text-sm font-medium mb-2 block">Seleccionar Impresora</label>
          <select
            className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            value={selectedPrinterId}
            onChange={(e) => setSelectedPrinterId(Number(e.target.value))}
          >
            <option value={0}>-- Selecciona una impresora --</option>
            {printers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo_negocio} - {p.marca} {p.modelo}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {selectedPrinterId > 0 && costLoading && (
        <LoadingSpinner text="Cargando costos de mantenimiento..." />
      )}

      {selectedPrinterId > 0 && isError && (
        <ErrorMessage message="Error al cargar costos" onRetry={() => refetch()} />
      )}

      {selectedPrinterId > 0 && costData && (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Resumen de Costos</h3>
              </div>
              {(() => {
                const d: PrinterCostData = costData
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div className="rounded-md border p-4">
                      <p className="text-sm text-muted-foreground">Total Mantenimientos</p>
                      <p className="text-xl font-bold">{d.total_mantenimientos}</p>
                    </div>
                    <div className="rounded-md border p-4">
                      <p className="text-sm text-muted-foreground">Costo Mantenimiento</p>
                      <p className="text-xl font-bold">{formatCurrency(d.costo_mantenimiento)}</p>
                    </div>
                    <div className="rounded-md border p-4">
                      <p className="text-sm text-muted-foreground">Costo Gastos</p>
                      <p className="text-xl font-bold">{formatCurrency(d.costo_gastos)}</p>
                    </div>
                    <div className="rounded-md border p-4">
                      <p className="text-sm text-muted-foreground">Costo Total</p>
                      <p className="text-xl font-bold text-primary">{formatCurrency(d.costo_total)}</p>
                    </div>
                    <div className="rounded-md border p-4">
                      <p className="text-sm text-muted-foreground">Costo Prom. / Orden</p>
                      <p className="text-xl font-bold">{formatCurrency(d.costo_promedio_por_orden)}</p>
                    </div>
                  </div>
                )
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Calculator className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Desglose Mensual</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mes</TableHead>
                    <TableHead className="text-right">Mantenimientos</TableHead>
                    <TableHead className="text-right">Costo Mantenimiento</TableHead>
                    <TableHead className="text-right">Costo Gastos</TableHead>
                    <TableHead className="text-right">Costo Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const breakdown: MonthlyBreakdown[] = costData.desglose_mensual ?? []
                    if (breakdown.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            No hay datos disponibles
                          </TableCell>
                        </TableRow>
                      )
                    }
                    return breakdown.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{row.mes}</TableCell>
                        <TableCell className="text-right">{row.total_mantenimientos}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.costo_mantenimiento)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.costo_gastos)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(row.costo_total)}</TableCell>
                      </TableRow>
                    ))
                  })()}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
