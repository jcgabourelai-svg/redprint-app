import { useState } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Download, BarChart3 } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
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

export default function ProfitabilityReport() {
  const [periodo, setPeriodo] = useState('mayo-2026')
  const [entidad, setEntidad] = useState('impresora')
  
  const { data: printerProfitability, isLoading: isLoadingPrinter } = useProfitabilityReport({ 
    periodo, 
    view: entidad 
  })
  const { data: clientProfitability, isLoading: isLoadingClient } = useClientProfitabilityReport({ 
    periodo 
  })

  const printerData = printerProfitability || []
  const clientData = clientProfitability || []

  const totalIngresos = printerData.reduce((s, p) => s + p.ingresos, 0)
  const totalCostos = printerData.reduce((s, p) => s + p.costos, 0)
  const totalRentabilidad = totalIngresos - totalCostos

  return (
    <PageLayout title="Finanzas" showSearch>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Rentabilidad</h2>
            <p className="text-sm text-gray-500">Reporte de rentabilidad por impresora, cliente y contrato</p>
          </div>
          <Button variant="secondary">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <Select
            options={[
              { value: 'mayo-2026', label: 'Mayo 2026' },
              { value: 'abril-2026', label: 'Abril 2026' },
              { value: 'marzo-2026', label: 'Marzo 2026' },
            ]}
            value={periodo}
            onChange={setPeriodo}
          />
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
                <div className="rounded-lg bg-blue-50 p-2">
                  <DollarSign className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ingresos Total</p>
                  <p className="text-lg font-bold">{formatCurrency(totalIngresos)}</p>
                  <p className="text-xs text-green-600 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> 12%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-50 p-2">
                  <DollarSign className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Costos Total</p>
                  <p className="text-lg font-bold">{formatCurrency(totalCostos)}</p>
                  <p className="text-xs text-red-600 flex items-center gap-1"><TrendingDown className="h-3 w-3" /> 8%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-50 p-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Rentabilidad Total</p>
                  <p className="text-lg font-bold text-green-600">+{formatCurrency(totalRentabilidad)}</p>
                  <p className="text-xs text-green-600 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> 15%</p>
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
                  <span className="text-sm text-gray-600 w-20">{item.mes}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-400 to-green-400 transition-all duration-500"
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
            <p className="text-gray-500">Cargando datos de rentabilidad...</p>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Rentabilidad por Impresora (Top 8)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Impresora</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Ingresos</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Costos</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Rentabilidad</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printerData.map((item) => (
                      <tr key={item.impresora_id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-3">
                          <p className="font-medium">{item.impresora_id}</p>
                          <p className="text-xs text-gray-500">{item.impresora_nombre}</p>
                        </td>
                        <td className="text-right py-3 px-3">{formatCurrency(item.ingresos)}</td>
                        <td className="text-right py-3 px-3">{formatCurrency(item.costos)}</td>
                        <td className={`text-right py-3 px-3 font-medium ${item.rentabilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {item.rentabilidad >= 0 ? '+' : ''}{formatCurrency(item.rentabilidad)}
                        </td>
                        <td className={`text-right py-3 px-3 font-medium ${item.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {item.roi >= 0 ? '+' : ''}{item.roi}%
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
            <p className="text-gray-500">Cargando datos por cliente...</p>
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
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Cliente</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Contratos</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Ingresos</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Costos</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Rentabilidad</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientData.map((item) => (
                      <tr key={item.cliente_id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-3 font-medium">{item.cliente_nombre}</td>
                        <td className="text-right py-3 px-3">{item.contratos}</td>
                        <td className="text-right py-3 px-3">{formatCurrency(item.ingresos)}</td>
                        <td className="text-right py-3 px-3">{formatCurrency(item.costos)}</td>
                        <td className="text-right py-3 px-3 font-medium text-green-600">+{formatCurrency(item.rentabilidad)}</td>
                        <td className="text-right py-3 px-3 font-medium">{item.margen}%</td>
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