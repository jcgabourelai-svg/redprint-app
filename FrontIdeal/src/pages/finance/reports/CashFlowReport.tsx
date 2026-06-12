import { useState } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Download, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/formatters'
import { useCashFlowReport } from '@/hooks/useFinanceReports'
import type { CashFlowData } from '@/types/finance-reports'

const mockIncomeBreakdown = [
  { cliente: 'Empresa Alpha S.A. de C.V.', facturas: 5, monto: 45000, porcentaje: 36 },
  { cliente: 'Grupo Beta México', facturas: 3, monto: 32500, porcentaje: 26 },
  { cliente: 'Corporativo Gamma', facturas: 2, monto: 28000, porcentaje: 22 },
  { cliente: 'Soluciones Delta S.C.', facturas: 2, monto: 12000, porcentaje: 10 },
  { cliente: 'Tecnologías Epsilon', facturas: 3, monto: 7500, porcentaje: 6 },
]

const mockExpenseBreakdown = [
  { categoria: 'Suministros', gastos: 18, monto: 12500, porcentaje: 44 },
  { categoria: 'Servicios', gastos: 12, monto: 8000, porcentaje: 28 },
  { categoria: 'Transporte', gastos: 8, monto: 5000, porcentaje: 18 },
  { categoria: 'Publicidad', gastos: 3, monto: 2000, porcentaje: 7 },
  { categoria: 'Impuestos', gastos: 2, monto: 1000, porcentaje: 3 },
]

export default function CashFlowReport() {
  const [periodo, setPeriodo] = useState('mayo-2026')
  const { data: cashFlowData, isLoading } = useCashFlowReport({ periodo })
  
  const cashFlow = cashFlowData || []
  const currentMonth = cashFlow.length > 0 ? cashFlow[cashFlow.length - 1] : null
  const previousMonth = cashFlow.length > 1 ? cashFlow[cashFlow.length - 2] : null
  const maxCashFlow = Math.max(...cashFlow.map(c => c.flujo_neto))

  return (
    <PageLayout title="Finanzas" showSearch>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Flujo de Caja</h2>
            <p className="text-sm text-gray-500">Reporte de flujo de caja mensual</p>
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
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Cargando datos de flujo de caja...</p>
          </div>
        ) : currentMonth ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-50 p-2">
                      <ArrowUpRight className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Ingresos</p>
                      <p className="text-lg font-bold">{formatCurrency(currentMonth.ingresos)}</p>
                      <p className="text-xs text-green-600 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> 12%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-red-50 p-2">
                      <ArrowDownRight className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Egresos</p>
                      <p className="text-lg font-bold">{formatCurrency(currentMonth.egresos)}</p>
                      <p className="text-xs text-red-600 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> 8%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-green-50 p-2">
                      <DollarSign className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Flujo Neto</p>
                      <p className="text-lg font-bold text-green-600">+{formatCurrency(currentMonth.flujo_neto)}</p>
                      <p className="text-xs text-green-600 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> 13%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Grafica de Flujo de Caja (ultimos {cashFlow.length} meses)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {cashFlow.map((item) => (
                    <div key={item.mes} className="flex items-center gap-4">
                      <span className="text-sm text-gray-600 w-20">{item.mes}</span>
                      <div className="flex-1 space-y-1">
                        <div className="bg-gray-100 rounded-full h-3 relative overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-400 transition-all duration-500"
                            style={{ width: `${(item.ingresos / (currentMonth?.ingresos || 1)) * 100}%` }}
                          />
                        </div>
                        <div className="bg-gray-100 rounded-full h-3 relative overflow-hidden">
                          <div
                            className="h-full rounded-full bg-red-400 transition-all duration-500"
                            style={{ width: `${(item.egresos / (currentMonth?.ingresos || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-medium w-24 text-right text-green-600">+{formatCurrency(item.flujo_neto)}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-4 mt-2 pt-2 border-t">
                    <span className="text-xs text-gray-500 w-20">Leyenda:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-400" />
                      <span className="text-xs text-gray-600">Ingresos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <span className="text-xs text-gray-600">Egresos</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Desglose de Ingresos</CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium text-gray-600">Cliente</th>
                        <th className="text-right py-2 font-medium text-gray-600">Facturas</th>
                        <th className="text-right py-2 font-medium text-gray-600">Monto</th>
                        <th className="text-right py-2 font-medium text-gray-600">% Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockIncomeBreakdown.map((item) => (
                        <tr key={item.cliente} className="border-b hover:bg-gray-50">
                          <td className="py-2 font-medium">{item.cliente}</td>
                          <td className="text-right py-2">{item.facturas}</td>
                          <td className="text-right py-2">{formatCurrency(item.monto)}</td>
                          <td className="text-right py-2">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-gray-100 rounded-full h-2">
                                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${item.porcentaje}%` }} />
                              </div>
                              <span>{item.porcentaje}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Desglose de Egresos</CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium text-gray-600">Categoria</th>
                        <th className="text-right py-2 font-medium text-gray-600">Gastos</th>
                        <th className="text-right py-2 font-medium text-gray-600">Monto</th>
                        <th className="text-right py-2 font-medium text-gray-600">% Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockExpenseBreakdown.map((item) => (
                        <tr key={item.categoria} className="border-b hover:bg-gray-50">
                          <td className="py-2 font-medium">{item.categoria}</td>
                          <td className="text-right py-2">{item.gastos}</td>
                          <td className="text-right py-2">{formatCurrency(item.monto)}</td>
                          <td className="text-right py-2">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-gray-100 rounded-full h-2">
                                <div className="h-full bg-red-400 rounded-full" style={{ width: `${item.porcentaje}%` }} />
                              </div>
                              <span>{item.porcentaje}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            {previousMonth && (
              <Card>
                <CardHeader>
                  <CardTitle>Comparativo vs Mes Anterior</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-4 font-medium text-gray-600">Concepto</th>
                          <th className="text-right py-2 px-4 font-medium text-gray-600">Mes Actual</th>
                          <th className="text-right py-2 px-4 font-medium text-gray-600">Mes Anterior</th>
                          <th className="text-right py-2 px-4 font-medium text-gray-600">Variacion</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="py-3 px-4 font-medium">Ingresos</td>
                          <td className="text-right py-3 px-4">{formatCurrency(currentMonth.ingresos)}</td>
                          <td className="text-right py-3 px-4">{formatCurrency(previousMonth.ingresos)}</td>
                          <td className="text-right py-3 px-4 text-green-600 font-medium">
                            +{((currentMonth.ingresos - previousMonth.ingresos) / previousMonth.ingresos * 100).toFixed(0)}%
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-3 px-4 font-medium">Egresos</td>
                          <td className="text-right py-3 px-4">{formatCurrency(currentMonth.egresos)}</td>
                          <td className="text-right py-3 px-4">{formatCurrency(previousMonth.egresos)}</td>
                          <td className="text-right py-3 px-4 text-red-600 font-medium">
                            +{((currentMonth.egresos - previousMonth.egresos) / previousMonth.egresos * 100).toFixed(0)}%
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-medium">Flujo Neto</td>
                          <td className="text-right py-3 px-4 font-bold text-green-600">{formatCurrency(currentMonth.flujo_neto)}</td>
                          <td className="text-right py-3 px-4">{formatCurrency(previousMonth.flujo_neto)}</td>
                          <td className="text-right py-3 px-4 text-green-600 font-medium">
                            +{((currentMonth.flujo_neto - previousMonth.flujo_neto) / previousMonth.flujo_neto * 100).toFixed(0)}%
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">No hay datos de flujo de caja disponibles</p>
          </div>
        )}
      </div>
    </PageLayout>
  )
}