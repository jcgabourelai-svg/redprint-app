import { useState } from 'react'
import { useProfitabilityReport } from '@/hooks/useFinanceReports'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, TrendingDown, DollarSign, Download, BarChart3 } from 'lucide-react'
import type { ProfitabilityData, ClientProfitability } from '@/types/models'

export default function ProfitabilityReport() {
  const [periodo, setPeriodo] = useState('mayo-2026')
  const [entidad, setEntidad] = useState('todas')

  const { data, isLoading, isError, refetch } = useProfitabilityReport({ periodo, entidad })

  if (isLoading) return <LoadingSpinner text="Cargando reporte..." />
  if (isError) return <ErrorMessage message="Error al cargar reporte de rentabilidad" onRetry={() => refetch()} />

  const printerData: ProfitabilityData[] = data?.printer_profitability ?? []
  const clientData: ClientProfitability[] = data?.client_profitability ?? []
  const trendData: { mes: string; valor: number }[] = data?.trend ?? []
  const maxTrend = Math.max(...trendData.map(t => t.valor), 1)

  const totalIngresos = printerData.reduce((s, p) => s + p.ingresos, 0)
  const totalCostos = printerData.reduce((s, p) => s + p.costos, 0)
  const totalRentabilidad = totalIngresos - totalCostos

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Rentabilidad</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reporte de rentabilidad por impresora, cliente y contrato
          </p>
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
        <Select
          label="Entidad"
          options={[
            { value: 'todas', label: 'Todas las entidades' },
            { value: 'impresora', label: 'Por impresora' },
            { value: 'cliente', label: 'Por cliente' },
          ]}
          value={entidad}
          onChange={(e) => setEntidad(e.target.value)}
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
                <p className="text-sm text-muted-foreground">Ingresos Total</p>
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
                <p className="text-sm text-muted-foreground">Costos Total</p>
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
                <p className="text-sm text-muted-foreground">Rentabilidad Total</p>
                <p className="text-lg font-bold text-green-600">+{formatCurrency(totalRentabilidad)}</p>
                <p className="text-xs text-green-600 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> 15%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {trendData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tendencia de Rentabilidad (ultimos 6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {trendData.map((item) => (
                <div key={item.mes} className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground w-20">{item.mes}</span>
                  <div className="flex-1 bg-muted rounded-full h-6 relative overflow-hidden">
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
      )}

      {printerData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Rentabilidad por Impresora
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Impresora</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                  <TableHead className="text-right">Costos</TableHead>
                  <TableHead className="text-right">Rentabilidad</TableHead>
                  <TableHead className="text-right">ROI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {printerData.map((item) => (
                  <TableRow key={item.impresora_id}>
                    <TableCell>
                      <p className="font-medium">{item.impresora_id}</p>
                      <p className="text-xs text-muted-foreground">{item.impresora_nombre}</p>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(item.ingresos)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.costos)}</TableCell>
                    <TableCell className={`text-right font-medium ${item.rentabilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.rentabilidad >= 0 ? '+' : ''}{formatCurrency(item.rentabilidad)}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${item.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.roi >= 0 ? '+' : ''}{item.roi}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {clientData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rentabilidad por Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Contratos</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                  <TableHead className="text-right">Costos</TableHead>
                  <TableHead className="text-right">Rentabilidad</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientData.map((item) => (
                  <TableRow key={item.cliente_id}>
                    <TableCell className="font-medium">{item.cliente_nombre}</TableCell>
                    <TableCell className="text-right">{item.contratos}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.ingresos)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.costos)}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">+{formatCurrency(item.rentabilidad)}</TableCell>
                    <TableCell className="text-right font-medium">{item.margen}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
