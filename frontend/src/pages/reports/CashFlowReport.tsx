import { useState } from 'react'
import { useCashFlowReport } from '@/hooks/useFinanceReports'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, DollarSign, Download, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import type { CashFlowData, IncomeBreakdown, ExpenseBreakdown } from '@/types/models'

export default function CashFlowReport() {
  const [periodo, setPeriodo] = useState('mayo-2026')

  const { data, isLoading, isError, refetch } = useCashFlowReport({ periodo })

  if (isLoading) return <LoadingSpinner text="Cargando reporte..." />
  if (isError) return <ErrorMessage message="Error al cargar reporte de flujo de caja" onRetry={() => refetch()} />

  const cashFlow: CashFlowData[] = data?.cash_flow ?? []
  const incomeBreakdown: IncomeBreakdown[] = data?.income_breakdown ?? []
  const expenseBreakdown: ExpenseBreakdown[] = data?.expense_breakdown ?? []

  const currentMonth = cashFlow[cashFlow.length - 1]
  const previousMonth = cashFlow.length >= 2 ? cashFlow[cashFlow.length - 2] : null
  const maxIngresos = Math.max(currentMonth?.ingresos ?? 0, 1)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Flujo de Caja</h1>
          <p className="text-sm text-muted-foreground mt-1">Reporte de flujo de caja mensual</p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exportar
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
        <Select
          label="Periodo"
          options={[
            { value: 'mayo-2026', label: 'Mayo 2026' },
            { value: 'abril-2026', label: 'Abril 2026' },
            { value: 'marzo-2026', label: 'Marzo 2026' },
          ]}
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
        />
      </div>

      {currentMonth && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 p-2">
                  <ArrowUpRight className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ingresos</p>
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
                  <p className="text-sm text-muted-foreground">Egresos</p>
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
                  <p className="text-sm text-muted-foreground">Flujo Neto</p>
                  <p className="text-lg font-bold text-green-600">+{formatCurrency(currentMonth.flujo_neto)}</p>
                  <p className="text-xs text-green-600 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> 13%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {cashFlow.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Grafica de Flujo de Caja (ultimos 6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {cashFlow.map((item) => (
                <div key={item.mes} className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground w-20">{item.mes}</span>
                  <div className="flex-1 space-y-1">
                    <div className="bg-muted rounded-full h-3 relative overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-400 transition-all duration-500"
                        style={{ width: `${(item.ingresos / maxIngresos) * 100}%` }}
                      />
                    </div>
                    <div className="bg-muted rounded-full h-3 relative overflow-hidden">
                      <div
                        className="h-full rounded-full bg-red-400 transition-all duration-500"
                        style={{ width: `${(item.egresos / maxIngresos) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium w-24 text-right text-green-600">
                    +{formatCurrency(item.flujo_neto)}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-4 mt-2 pt-2 border-t">
                <span className="text-xs text-muted-foreground w-20">Leyenda:</span>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-400" />
                  <span className="text-xs text-muted-foreground">Ingresos</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <span className="text-xs text-muted-foreground">Egresos</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {incomeBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Desglose de Ingresos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Facturas</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">% Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomeBreakdown.map((item) => (
                    <TableRow key={item.cliente}>
                      <TableCell className="font-medium">{item.cliente}</TableCell>
                      <TableCell className="text-right">{item.facturas}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.monto)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-muted rounded-full h-2">
                            <div className="h-full bg-blue-400 rounded-full" style={{ width: `${item.porcentaje}%` }} />
                          </div>
                          <span>{item.porcentaje}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {expenseBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Desglose de Egresos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Gastos</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">% Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseBreakdown.map((item) => (
                    <TableRow key={item.categoria}>
                      <TableCell className="font-medium">{item.categoria}</TableCell>
                      <TableCell className="text-right">{item.gastos}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.monto)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-muted rounded-full h-2">
                            <div className="h-full bg-red-400 rounded-full" style={{ width: `${item.porcentaje}%` }} />
                          </div>
                          <span>{item.porcentaje}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {currentMonth && previousMonth && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Comparativo vs Mes Anterior</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Concepto</TableHead>
                  <TableHead className="text-right">{currentMonth.mes}</TableHead>
                  <TableHead className="text-right">{previousMonth.mes}</TableHead>
                  <TableHead className="text-right">Variacion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Ingresos</TableCell>
                  <TableCell className="text-right">{formatCurrency(currentMonth.ingresos)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(previousMonth.ingresos)}</TableCell>
                  <TableCell className="text-right text-green-600 font-medium">
                    +{previousMonth.ingresos !== 0 ? ((currentMonth.ingresos - previousMonth.ingresos) / previousMonth.ingresos * 100).toFixed(0) : '0'}%
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Egresos</TableCell>
                  <TableCell className="text-right">{formatCurrency(currentMonth.egresos)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(previousMonth.egresos)}</TableCell>
                  <TableCell className="text-right text-red-600 font-medium">
                    +{previousMonth.egresos !== 0 ? ((currentMonth.egresos - previousMonth.egresos) / previousMonth.egresos * 100).toFixed(0) : '0'}%
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Flujo Neto</TableCell>
                  <TableCell className="text-right font-bold text-green-600">{formatCurrency(currentMonth.flujo_neto)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(previousMonth.flujo_neto)}</TableCell>
                  <TableCell className="text-right text-green-600 font-medium">
                    +{previousMonth.flujo_neto !== 0 ? ((currentMonth.flujo_neto - previousMonth.flujo_neto) / previousMonth.flujo_neto * 100).toFixed(0) : '0'}%
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
