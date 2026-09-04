import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Search, DollarSign } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { useProblematicPrinters, usePrinterMaintenanceCost } from '@/hooks/useMaintenanceReports'
import { usePrinters } from '@/hooks/usePrinters'
import { useDebounce } from '@/hooks/useDebounce'
import { formatCurrency } from '@/lib/formatters'

export default function MaintenanceReports() {
  const navigate = useNavigate()
  const { data: problematic, isLoading } = useProblematicPrinters(10)

  const [serieSearch, setSerieSearch] = useState('')
  const debouncedSerie = useDebounce(serieSearch, 350)
  const { data: printersData } = usePrinters(
    debouncedSerie.trim() !== '' ? { search: debouncedSerie, per_page: 10 } : undefined,
  )
  const printers = printersData?.data ?? []

  const [selectedPrinterId, setSelectedPrinterId] = useState<number | null>(null)
  const { data: cost, isFetching: costFetching } = usePrinterMaintenanceCost(
    selectedPrinterId ? String(selectedPrinterId) : '',
  )

  const selectedPrinter = printers.find((p: any) => p.id === selectedPrinterId)

  return (
    <PageLayout title="Inventario › Mantenimiento › Reportes">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Reportes de Mantenimiento</h2>
            <p className="text-sm text-muted-foreground">
              Impresoras problemáticas y costo acumulado por equipo
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/inventario/mantenimiento')}>
            Volver a órdenes
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <CardTitle>Impresoras problemáticas</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : !problematic || problematic.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  No hay datos de mantenimientos completados todavía
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Impresora</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Código</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Mantenimientos</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Costo promedio</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Costo total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {problematic.map((row: any) => (
                      <tr
                        key={row.impresora_id}
                        className="border-b border-border cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setSelectedPrinterId(row.impresora_id)
                          setSerieSearch('')
                        }}
                      >
                        <td className="px-4 py-2 font-medium">
                          {row.impresora_marca} {row.impresora_modelo}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{row.impresora_codigo ?? '-'}</td>
                        <td className="px-4 py-2 text-right">{row.total_mantenimientos}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(row.costo_promedio)}</td>
                        <td className="px-4 py-2 text-right font-medium">{formatCurrency(row.costo_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <CardTitle>Costo por impresora</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-w-md">
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Buscar por número de serie o código
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={serieSearch}
                  onChange={(e) => {
                    setSerieSearch(e.target.value)
                    setSelectedPrinterId(null)
                  }}
                  placeholder="Ej. SN-12345"
                  className="pl-8"
                />
              </div>
              {serieSearch.trim() !== '' && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-border">
                  {printers.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</p>
                  ) : (
                    printers.map((p: any) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPrinterId(p.id)
                          setSerieSearch('')
                        }}
                        className="flex w-full items-center justify-between px-3 py-2 text-sm text-left hover:bg-muted"
                      >
                        <span className="truncate">
                          {p.marca} {p.modelo}
                        </span>
                        <span className="ml-2 whitespace-nowrap text-xs text-muted-foreground">
                          {p.num_serie ?? p.codigo_negocio}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {costFetching && (
              <p className="mt-4 text-sm text-muted-foreground">Calculando costos...</p>
            )}

            {cost && !costFetching && (
              <div className="mt-4 space-y-4">
                <p className="text-sm font-medium text-foreground">
                  {selectedPrinter
                    ? `${selectedPrinter.marca} ${selectedPrinter.modelo} (#${selectedPrinter.id})`
                    : `Impresora #${cost.impresora_id}`}
                </p>
                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Mantenimientos completados</p>
                    <p className="text-lg font-bold">{cost.total_mantenimientos}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Costo mantenimiento</p>
                    <p className="text-lg font-bold">{formatCurrency(cost.costo_mantenimiento)}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Gastos del equipo</p>
                    <p className="text-lg font-bold">{formatCurrency(cost.costo_gastos)}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-primary/5 p-3">
                    <p className="text-xs text-muted-foreground">Costo total</p>
                    <p className="text-lg font-bold text-primary">{formatCurrency(cost.costo_total)}</p>
                  </div>
                </div>

                {Object.keys(cost.desglose_mensual ?? {}).length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Desglose mensual</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="py-2 text-left text-xs font-medium text-muted-foreground">Mes</th>
                            <th className="py-2 text-right text-xs font-medium text-muted-foreground">Costo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries<any>(cost.desglose_mensual)
                            .sort(([a], [b]) => (a < b ? 1 : -1))
                            .map(([mes, monto]) => (
                              <tr key={mes} className="border-b border-border">
                                <td className="py-2">{mes}</td>
                                <td className="py-2 text-right font-medium">{formatCurrency(monto)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}
