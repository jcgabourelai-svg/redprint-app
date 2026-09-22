import { Fragment, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Search, DollarSign, Package, ChevronDown, ChevronRight } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { useProblematicPrinters, usePrinterMaintenanceCost, useTopArticles, useFailures } from '@/hooks/useMaintenanceReports'
import { usePrinters } from '@/hooks/usePrinters'
import { useDebounce } from '@/hooks/useDebounce'
import { formatCurrency } from '@/lib/formatters'
import { problemTypeLabels } from '@/lib/maintenanceProblem'

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

  // Rango compartido para las tablas analíticas (vacío = histórico completo).
  const [rangoDesde, setRangoDesde] = useState('')
  const [rangoHasta, setRangoHasta] = useState('')
  const rangoParams: { fecha_desde?: string; fecha_hasta?: string } = {}
  if (rangoDesde) rangoParams.fecha_desde = rangoDesde
  if (rangoHasta) rangoParams.fecha_hasta = rangoHasta

  const { data: topArticles, isLoading: topLoading } = useTopArticles(rangoParams)
  const { data: failures, isLoading: failuresLoading } = useFailures(rangoParams)
  const [expandedFalla, setExpandedFalla] = useState<string | null>(null)

  return (
    <PageLayout title="Inventario › Mantenimiento › Reportes">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Reportes de Mantenimiento</h2>
            <p className="text-sm text-muted-foreground">
              Impresoras problemáticas, costo acumulado, piezas más usadas y ranking de fallas
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/inventario/mantenimiento')}>
            Volver a órdenes
          </Button>
        </div>

        <div className="flex items-end gap-3 flex-wrap">
          <div className="w-44">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Analítica desde</label>
            <Input type="date" value={rangoDesde} onChange={(e) => setRangoDesde(e.target.value)} />
          </div>
          <div className="w-44">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Analítica hasta</label>
            <Input type="date" value={rangoHasta} onChange={(e) => setRangoHasta(e.target.value)} />
          </div>
          {(rangoDesde || rangoHasta) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRangoDesde('')
                setRangoHasta('')
              }}
            >
              Histórico completo
            </Button>
          )}
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

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <CardTitle>Piezas más usadas</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {topLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : !topArticles || topArticles.top.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  No hay piezas consumidas en órdenes completadas para este rango
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Artículo</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Tipo</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Cantidad</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Costo total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topArticles.top.map((row) => (
                      <tr key={row.articulo_id} className="border-b border-border">
                        <td className="px-4 py-2 font-medium">{row.nombre}</td>
                        <td className="px-4 py-2 text-muted-foreground">{row.tipo_articulo}</td>
                        <td className="px-4 py-2 text-right">{row.total_cantidad}</td>
                        <td className="px-4 py-2 text-right font-medium">{formatCurrency(row.total_costo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {topArticles && Object.keys(topArticles.por_origen ?? {}).length > 0 && (
              <div className="border-t border-border px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Desglose por origen (snapshot al usar la pieza)</p>
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  {Object.entries(topArticles.por_origen).map(([origen, datos]) => (
                    <span key={origen} className="text-sm">
                      {origen === 'SIN_ESPECIFICAR' ? 'Sin especificar' : origen.charAt(0) + origen.slice(1).toLowerCase()} ·{' '}
                      {datos.total_cantidad} u · {formatCurrency(datos.total_costo)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <CardTitle>Ranking de fallas</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {failuresLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : !failures?.ranking || failures.ranking.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  No hay fallas correctivas completadas para este rango
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground w-8"></th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Falla</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Modelo</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Total</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Costo total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failures.ranking.map((row, idx) => {
                      const key = `${row.tipo_problema}-${row.modelo_id ?? 'null'}-${idx}`
                      const expandida = expandedFalla === key
                      const piezas = failures.piezas_asociadas?.[row.tipo_problema] ?? []
                      return (
                        <Fragment key={key}>
                          <tr
                            className="border-b border-border cursor-pointer hover:bg-muted/50"
                            onClick={() => setExpandedFalla(expandida ? null : key)}
                          >
                            <td className="px-4 py-2">
                              {piezas.length > 0 &&
                                (expandida ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                ))}
                            </td>
                            <td className="px-4 py-2 font-medium">
                              {problemTypeLabels[row.tipo_problema] ?? row.tipo_problema}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {row.marca} {row.modelo}
                            </td>
                            <td className="px-4 py-2 text-right">{row.total}</td>
                            <td className="px-4 py-2 text-right font-medium">{formatCurrency(row.costo_total)}</td>
                          </tr>
                          {expandida && piezas.length > 0 && (
                            <tr className="border-b border-border bg-muted/30">
                              <td></td>
                              <td colSpan={4} className="px-4 py-2">
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Piezas asociadas a esta falla (todas las filas del grupo)
                                </p>
                                <div className="flex flex-wrap gap-x-6 gap-y-1">
                                  {piezas.map((p) => (
                                    <span key={p.articulo_id} className="text-sm">
                                      {p.nombre} · {p.total_cantidad} u · {formatCurrency(p.total_costo)}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}
