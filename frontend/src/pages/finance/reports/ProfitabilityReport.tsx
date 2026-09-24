import { useState } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Download, BarChart3 } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/formatters'
import { useProfitabilityReport, useClientProfitabilityReport } from '@/hooks/useFinanceReports'
import type { ProfitabilityData, ClientProfitability } from '@/types/finance-reports'

const mockTrend = [
  { mes: 'Dic 2025', valor: 58000 },
  { mes: 'Ene 2026', valor: 65500 },
  { mes: 'Feb 2026', valor: 72000 },
  { mes: 'Mar 2026', valor: 78500 },
  { mes: 'Abr 2026', valor: 85500 },
  { mes: 'May 2026', valor: 96500 },
]

const maxTrend = Math.max(...mockTrend.map(t => t.valor))

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ProfitabilityReport() {
  const hoy = new Date()
  const [periodoInicio, setPeriodoInicio] = useState(
    toISODate(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
  )
  const [periodoFin, setPeriodoFin] = useState(
    toISODate(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0))
  )
  const [entidad, setEntidad] = useState('impresora')

  const params = { periodo_inicio: periodoInicio, periodo_fin: periodoFin }
  const { data: printerProfitability, isLoading: isLoadingPrinter } = useProfitabilityReport(params)
  const { data: clientProfitability, isLoading: isLoadingClient } = useClientProfitabilityReport(params)

  const printerData: ProfitabilityData[] = printerProfitability || []
  const clientData: ClientProfitability[] = clientProfitability || []

  const totalIngresos = printerData.reduce((s, p) => s + p.ingresos, 0)
  const totalCostos = printerData.reduce((s, p) => s + p.costos, 0)
  const totalMargen = totalIngresos - totalCostos

  return (
    <PageLayout title="Finanzas" showSearch>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Rentabilidad</h2>
            <p className="text-sm text-muted-foreground">Reporte de rentabilidad por impresora y cliente</p>
          </div>
          <Button variant="secondary">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="w-44">
            <label htmlFor="periodo-inicio" className="mb-1 block text-xs text-muted-foreground">
              Desde
            </label>
            <Input
              id="periodo-inicio"
              type="date"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
            />
          </div>
          <div className="w-44">
            <label htmlFor="periodo-fin" className="mb-1 block text-xs text-muted-foreground">
              Hasta
            </label>
            <Input
              id="periodo-fin"
              type="date"
              value={periodoFin}
              onChange={(e) => setPeriodoFin(e.target.value)}
            />
          </div>
          <Select
            options={[
              { value: 'impresora', label: 'Por impresora' },
              { value: 'cliente', label: 'Por cliente' },
            ]}
            value={entidad}
            onChange={setEntidad}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ingresos Total</p>
                  <p className="text-lg font-bold">{formatCurrency(totalIngresos)}</p>
                  <p className="text-xs text-success flex items-center gap-1"><TrendingUp className="h-3 w-3" /> 12%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-destructive/10 p-2">
                  <DollarSign className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Costos Total</p>
                  <p className="text-lg font-bold">{formatCurrency(totalCostos)}</p>
                  <p className="text-xs text-destructive flex items-center gap-1"><TrendingDown className="h-3 w-3" /> 8%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-success/10 p-2">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rentabilidad Total</p>
                  <p className="text-lg font-bold text-success">+{formatCurrency(totalMargen)}</p>
                  <p className="text-xs text-success flex items-center gap-1"><TrendingUp className="h-3 w-3" /> 15%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tendencia de Rentabilidad (ultimos 6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockTrend.map((item) => (
                <div key={item.mes} className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground w-20">{item.mes}</span>
                  <div className="flex-1 bg-muted rounded-full h-6 relative overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-success transition-all duration-500"
                      style={{ width: `${(item.valor / maxTrend) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-24 text-right">{formatCurrency(item.valor)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {isLoadingPrinter ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Cargando datos de rentabilidad...</p>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Rentabilidad por Impresora
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Impresora</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Ingresos</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Costos</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Insumos tóner</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Margen</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">ROI</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Páginas</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Costo/pág tóner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printerData.map((item) => (
                      <tr key={item.impresora_id} className="border-b hover:bg-muted">
                        <td className="py-3 px-3">
                          <p className="font-medium">{item.codigo_negocio ?? `#${item.impresora_id}`}</p>
                          <p className="text-xs text-muted-foreground">{item.marca} {item.modelo}</p>
                        </td>
                        <td className="text-right py-3 px-3">{formatCurrency(item.ingresos)}</td>
                        <td className="text-right py-3 px-3">{formatCurrency(item.costos)}</td>
                        <td className="text-right py-3 px-3">{formatCurrency(item.insumos_toner)}</td>
                        <td className={`text-right py-3 px-3 font-medium ${item.margen >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {item.margen >= 0 ? '+' : ''}{formatCurrency(item.margen)}
                        </td>
                        <td className={`text-right py-3 px-3 font-medium ${item.roi != null && item.roi >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {item.roi != null ? `${item.roi}%` : '—'}
                        </td>
                        <td className="text-right py-3 px-3 tabular-nums">
                          {item.paginas_periodo.toLocaleString('es-MX')}
                        </td>
                        <td className="text-right py-3 px-3 tabular-nums">
                          {item.costo_toner_por_pagina != null
                            ? `${formatCurrency(item.costo_toner_por_pagina)} (estimado)`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoadingClient ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Cargando datos por cliente...</p>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Rentabilidad por Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Cliente</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Ingresos</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Costos</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Insumos tóner</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientData.map((item) => (
                      <tr key={item.cliente_id} className="border-b hover:bg-muted">
                        <td className="py-3 px-3 font-medium">{item.razon_social}</td>
                        <td className="text-right py-3 px-3">{formatCurrency(item.ingresos)}</td>
                        <td className="text-right py-3 px-3">{formatCurrency(item.costos)}</td>
                        <td className="text-right py-3 px-3">{formatCurrency(item.insumos_toner)}</td>
                        <td className={`text-right py-3 px-3 font-medium ${item.margen >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {item.margen >= 0 ? '+' : ''}{formatCurrency(item.margen)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageLayout>
  )
}
