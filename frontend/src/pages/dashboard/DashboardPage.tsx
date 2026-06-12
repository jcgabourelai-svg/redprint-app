import { useNavigate } from 'react-router-dom'
import { useDashboard } from '@/hooks/useDashboard'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PRINTER_STATUS_LABELS, INVOICE_STATUS_LABELS, VISIT_STATUS_LABELS } from '@/types/enums'
import {
  DollarSign,
  FileText,
  CalendarCheck,
  AlertTriangle,
  Printer,
  ClipboardList,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useDashboard()

  if (isLoading) return <LoadingSpinner text="Cargando dashboard..." />
  if (isError) return <ErrorMessage message="Error al cargar dashboard" onRetry={() => refetch()} />
  if (!data) return null

  const revenueTrend = data.kpis.ingresos_mes_anterior > 0
    ? ((data.kpis.ingresos_mes - data.kpis.ingresos_mes_anterior) / data.kpis.ingresos_mes_anterior) * 100
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Resumen general del sistema
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ingresos del Mes</p>
                <p className="text-2xl font-bold">{formatCurrency(data.kpis.ingresos_mes)}</p>
                <div className="flex items-center gap-1 mt-1">
                  {revenueTrend >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-success" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-destructive" />
                  )}
                  <span className={`text-xs ${revenueTrend >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {revenueTrend >= 0 ? '+' : ''}{revenueTrend.toFixed(1)}% vs mes anterior
                  </span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Facturas Pendientes</p>
                <p className="text-2xl font-bold">{data.kpis.facturas_pendientes}</p>
                {data.kpis.facturas_vencidas > 0 && (
                  <p className="text-xs text-destructive mt-1">
                    {data.kpis.facturas_vencidas} vencidas
                  </p>
                )}
              </div>
              <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Visitas Pendientes</p>
                <p className="text-2xl font-bold">{data.kpis.visitas_pendientes}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.kpis.mis_visitas_proximas} asignadas a ti
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-info/10 flex items-center justify-center">
                <CalendarCheck className="h-6 w-6 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saldo Pendiente</p>
                <p className="text-2xl font-bold">{formatCurrency(data.kpis.saldo_pendiente_total)}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-error/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-error" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h3 className="text-lg font-semibold">Alertas Criticas</h3>
            </div>
            <div className="space-y-3">
              {data.alertas.facturas_vencidas.length === 0 && data.alertas.visitas_proximas.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay alertas criticas</p>
              )}
              {data.alertas.facturas_vencidas.map((factura) => (
                <div
                  key={factura.id}
                  className="flex items-center justify-between rounded-md border border-destructive/20 bg-destructive/5 p-3 cursor-pointer hover:bg-destructive/10"
                  onClick={() => navigate('/facturas')}
                >
                  <div>
                    <p className="text-sm font-medium">
                      Factura vencida: {factura.numero_factura}
                    </p>
                    <p className="text-xs text-muted-foreground">{factura.client.razon_social}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-destructive">
                      {formatCurrency(factura.saldo_pendiente)}
                    </p>
                  </div>
                </div>
              ))}
              {data.alertas.visitas_proximas.map((visita, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-md border border-warning/20 bg-warning/5 p-3 cursor-pointer hover:bg-warning/10"
                  onClick={() => navigate(`/visitas/${visita.visit_id}`)}
                >
                  <div>
                    <p className="text-sm font-medium">Visita: {visita.client}</p>
                    <p className="text-xs text-muted-foreground">{visita.type}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{formatDate(visita.date)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Printer className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Impresoras por Estado</h3>
            </div>
            <div className="space-y-3">
              {Object.entries(data.impresoras_por_estado).map(([estado, count]) => {
                const total = Object.values(data.impresoras_por_estado).reduce((a, b) => a + b, 0)
                const percentage = total > 0 ? (count / total) * 100 : 0
                const colorMap: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
                  EN_ALMACEN: 'info',
                  RENTADA: 'success',
                  EN_MANTENIMIENTO: 'warning',
                  DADA_DE_BAJA: 'error',
                }
                return (
                  <div key={estado}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">
                        {PRINTER_STATUS_LABELS[estado as keyof typeof PRINTER_STATUS_LABELS] ?? estado}
                      </span>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                    <ProgressBar value={percentage} color={colorMap[estado] ?? 'default'} />
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {data.alertas.visitas_proximas.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Tareas Pendientes</h3>
            </div>
            <div className="space-y-2">
              {data.alertas.visitas_proximas.map((visita, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-md border p-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/visitas/${visita.visit_id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <CalendarCheck className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{visita.client}</p>
                      <p className="text-xs text-muted-foreground">{visita.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{formatDate(visita.date)}</p>
                    <Badge variant="warning">Pendiente</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
