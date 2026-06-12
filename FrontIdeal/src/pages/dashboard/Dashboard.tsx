import { useState } from 'react'
import { DollarSign, Printer, AlertTriangle, FileText, Calendar } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import KPICard from '@/components/dashboard/KPICard'
import AlertCard from '@/components/dashboard/AlertCard'
import PendingTasksList from '@/components/dashboard/PendingTasksList'
import TopProfitabilityCard from '@/components/dashboard/TopProfitabilityCard'
import { useDashboard } from '@/hooks/useDashboard'
import { formatCurrency } from '@/lib/formatters'
import { getMaintenanceStatusColor } from '@/lib/formatters'

export default function Dashboard() {
  const { data: dashboardData, isLoading, error } = useDashboard()

  if (isLoading) {
    return (
      <PageLayout title="Dashboard" showSearch>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Dashboard" showSearch>
        <div className="flex items-center justify-center h-64">
          <p className="text-red-600">Error al cargar el dashboard</p>
        </div>
      </PageLayout>
    )
  }

  const kpis = dashboardData?.kpis || {}
  const impresorasPorEstado = dashboardData?.impresoras_por_estado || {}
  const alertas = dashboardData?.alertas || {}

  const kpiData = [
    {
      title: 'Ingresos del mes',
      value: typeof kpis.ingresos_mes === 'number' ? formatCurrency(kpis.ingresos_mes) : '$0',
      subtitle: 'Mayo 2026',
      trend: 'down' as const,
      trendValue: '5% vs mes anterior',
      icon: <DollarSign className="h-6 w-6 text-white" />,
      color: 'blue' as const,
    },
    {
      title: 'Facturas por cobrar',
      value: typeof kpis.facturas_pendientes === 'number' ? formatCurrency(kpis.facturas_pendientes) : '$0',
      trend: 'down' as const,
      trendValue: '3% vs mes anterior',
      icon: <FileText className="h-6 w-6 text-white" />,
      color: 'amber' as const,
    },
    {
      title: 'Impresoras rentadas',
      value: `${impresorasPorEstado.rentada || 0} / ${(impresorasPorEstado.rentada || 0) + (impresorasPorEstado.en_almacen || 0)}`,
      trend: 'neutral' as const,
      icon: <Printer className="h-6 w-6 text-white" />,
      color: 'green' as const,
    },
    {
      title: 'Visitas pendientes',
      value: String(kpis.visitas_pendientes || 0),
      icon: <Calendar className="h-6 w-6 text-white" />,
      color: 'blue' as const,
    },
    {
      title: 'Alertas activas',
      value: String((alertas.stock_bajo?.length || 0) + (alertas.facturas_vencidas?.length || 0)),
      icon: <AlertTriangle className="h-6 w-6 text-white" />,
      color: 'red' as const,
    },
  ]

  const alerts = [
    ...(alertas.stock_bajo || []).map((alert: any) => ({
      type: 'warning' as const,
      title: 'Stock bajo',
      message: alert.mensaje || alert.articulo_nombre,
    })),
    ...(alertas.facturas_vencidas || []).map((alert: any) => ({
      type: 'error' as const,
      title: 'Facturas vencidas',
      message: `Total: ${formatCurrency(alert.total || 0)}`,
      action: 'Ver detalle',
    })),
    ...(alertas.visitas_pendientes || []).map((alert: any) => ({
      type: 'error' as const,
      title: 'Cliente sin visita',
      message: `${alert.cliente_nombre} - Última visita: ${alert.ultima_visita}`,
      action: 'Programar visita',
    })),
  ]

  const pendingTasks = (kpis.facturas_pendientes_detalles || []).map((task: any) => ({
    id: task.id,
    title: task.cliente_nombre,
    subtitle: `${formatCurrency(task.saldo_pendiente)} - ${task.responsable}`,
    time: `Vence: ${task.fecha_vencimiento}`,
    icon: <FileText className="h-4 w-4 text-red-500" />,
    status: 'high' as const,
    action: 'Registrar pago',
  }))

  const visitasHoy = (kpis.visitas_hoy || []).map((visita: any) => ({
    id: visita.id,
    title: visita.cliente_nombre,
    subtitle: `${visit.responsable} - ${visit.num_impresoras} impresoras`,
    time: visita.hora,
    icon: <Calendar className="h-4 w-4 text-blue-500" />,
    action: 'Marcar como completada',
  }))

  const topPrinters = (kpis.top_impresoras || []).map((printer: any) => ({
    id: printer.id,
    name: printer.codigo_negocio,
    model: printer.modelo,
    profitability: printer.rentabilidad || 0,
    trend: (printer.tendencia || 'neutral') as 'up' | 'down' | 'neutral',
  }))

  return (
    <PageLayout title="Dashboard" showSearch>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {kpiData.map((kpi, index) => (
            <KPICard key={index} {...kpi} />
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <PendingTasksList
            title="Facturas Pendientes"
            tasks={pendingTasks}
            viewAllText="Ver todas las facturas"
            onViewAllClick={() => console.log('View all invoices')}
          />

          <PendingTasksList
            title="Próximas Visitas"
            subtitle="Hoy (8 de mayo de 2026)"
            tasks={visitasHoy}
            viewAllText="Ver calendario"
            onViewAllClick={() => console.log('View calendar')}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Alertas</h3>
            {alerts.map((alert, index) => (
              <AlertCard key={index} {...alert} />
            ))}
          </div>

          <TopProfitabilityCard
            title="Rentabilidad Top 5"
            printers={topPrinters}
            viewReportText="Ver reporte"
            onViewReportClick={() => console.log('View profitability report')}
          />
        </div>
      </div>
    </PageLayout>
  )
}
