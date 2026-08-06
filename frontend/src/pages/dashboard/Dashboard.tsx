import { DollarSign, Printer, FileText, Calendar, Package, Wrench } from 'lucide-react'
import type { ComponentProps } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '@/components/layout/PageLayout'
import KPICard from '@/components/dashboard/KPICard'
import AlertCard from '@/components/dashboard/AlertCard'
import PendingTasksList from '@/components/dashboard/PendingTasksList'
import TopProfitabilityCard from '@/components/dashboard/TopProfitabilityCard'
import IngresosChart from '@/components/dashboard/charts/IngresosChart'
import FlujoCajaChart from '@/components/dashboard/charts/FlujoCajaChart'
import EstadoFlotaChart from '@/components/dashboard/charts/EstadoFlotaChart'
import { useDashboard } from '@/hooks/useDashboard'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { useTienePermiso } from '@/contexts/AuthContext'

export default function Dashboard() {
  const { data: dashboardData, isLoading, error } = useDashboard()
  const navigate = useNavigate()

  const tieneFacturas = useTienePermiso('finanzas.facturas')
  const tieneCuentasCobrar = useTienePermiso('finanzas.cuentas-por-cobrar')
  const tieneLecturas = useTienePermiso('operaciones.lecturas')
  const tieneImpresoras = useTienePermiso('inventario.impresoras')
  const tieneArticulos = useTienePermiso('inventario.articulos')
  const tieneMantenimiento = useTienePermiso('inventario.mantenimiento')
  const tieneFlujoCaja = useTienePermiso('finanzas.flujo-caja')
  const tieneRentabilidad = useTienePermiso('finanzas.rentabilidad')
  const tieneCalendario = useTienePermiso('operaciones.calendario')
  const tieneCompras = useTienePermiso('finanzas.compras')
  const tieneCuentasPagar = useTienePermiso('finanzas.cuentas-por-pagar')

  if (isLoading) {
    return (
      <PageLayout title="Dashboard" showSearch>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Dashboard" showSearch>
        <div className="flex items-center justify-center h-64">
          <p className="text-destructive">Error al cargar el dashboard</p>
        </div>
      </PageLayout>
    )
  }

  const kpis = dashboardData?.kpis
  const impresorasPorEstado = dashboardData?.impresoras_por_estado ?? {}
  const series = dashboardData?.series
  const alertas = dashboardData?.alertas

  const rentada = impresorasPorEstado.RENTADA ?? 0
  const enAlmacen = impresorasPorEstado.EN_ALMACEN ?? 0
  const enMantenimiento = impresorasPorEstado.EN_MANTENIMIENTO ?? 0
  const totalActivo = rentada + enAlmacen + enMantenimiento

  const tendencia = kpis?.tendencia_ingresos_pct
  const tendenciaTrend = tendencia == null
    ? undefined
    : tendencia > 0
      ? 'up'
      : tendencia < 0
        ? 'down'
        : ('neutral' as const)
  const tendenciaValue = tendencia == null
    ? undefined
    : `${tendencia > 0 ? '+' : ''}${tendencia}% vs mes anterior`

  const kpiData = [
    tieneFacturas && {
      title: 'Ingresos del mes',
      value: formatCurrency(kpis?.ingresos_mes ?? 0),
      trend: tendenciaTrend,
      trendValue: tendenciaValue,
      icon: <DollarSign className="h-6 w-6 text-white" />,
      color: 'blue' as const,
    },
    tieneCuentasCobrar && {
      title: 'Saldo por cobrar',
      value: formatCurrency(kpis?.saldo_pendiente_total ?? 0),
      subtitle: `${kpis?.facturas_pendientes ?? 0} facturas pendientes`,
      icon: <FileText className="h-6 w-6 text-white" />,
      color: 'amber' as const,
    },
    tieneLecturas && {
      title: 'Páginas impresas del mes',
      value: (kpis?.paginas_impresas_mes ?? 0).toLocaleString('es-MX'),
      icon: <Printer className="h-6 w-6 text-white" />,
      color: 'green' as const,
    },
    tieneImpresoras && {
      title: 'Flota en renta',
      value: `${rentada} / ${totalActivo}`,
      subtitle: 'Rentadas / flota activa',
      icon: <Printer className="h-6 w-6 text-white" />,
      color: 'blue' as const,
    },
    tieneArticulos && {
      title: 'Valor de inventario',
      value: formatCurrency(kpis?.valor_inventario ?? 0),
      subtitle: `${kpis?.stock_bajo ?? 0} artículos con stock bajo`,
      icon: <Package className="h-6 w-6 text-white" />,
      color: 'amber' as const,
    },
    tieneMantenimiento && {
      title: 'Mantenimientos pendientes',
      value: String(kpis?.mantenimientos_pendientes ?? 0),
      subtitle: `${kpis?.impresoras_en_mantenimiento ?? 0} en taller`,
      icon: <Wrench className="h-6 w-6 text-white" />,
      color: 'red' as const,
    },
  ].filter(Boolean) as ComponentProps<typeof KPICard>[]

  const facturasVencidasTasks = (alertas?.facturas_vencidas ?? []).map((factura) => ({
    id: factura.id,
    title: factura.client?.razon_social ?? factura.numero_factura,
    subtitle: formatCurrency(factura.saldo_pendiente),
    time: `Vence: ${formatDate(factura.fecha_vencimiento)}`,
    icon: <FileText className="h-4 w-4 text-destructive" />,
    status: 'high' as const,
  }))

  const visitasProximasTasks = (alertas?.visitas_proximas ?? []).map((visita) => ({
    id: visita.visit_id ?? visita.client ?? Math.random(),
    title: visita.client ?? 'Visita programada',
    time: formatDate(visita.date),
    icon: <Calendar className="h-4 w-4 text-primary" />,
  }))

  const stockBajoCount = alertas?.articulos_stock_bajo?.length ?? 0
  const comprasPorVencer = alertas?.compras_por_vencer ?? []
  const mantenimientosPendientes = alertas?.mantenimientos_pendientes ?? []

  const showRow2 = (tieneFacturas && series) || tieneImpresoras
  const showRow3 = tieneFlujoCaja || tieneRentabilidad
  const showRow4 = tieneFacturas || tieneCalendario
  const showRow5 = tieneArticulos || tieneCuentasPagar || tieneMantenimiento

  return (
    <PageLayout title="Dashboard" showSearch>
      <div className="space-y-6">
        {kpiData.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {kpiData.map((kpi, index) => (
              <KPICard key={index} {...kpi} />
            ))}
          </div>
        )}

        {showRow2 && (
          <div className="grid gap-6 lg:grid-cols-2">
            {tieneFacturas && series && <IngresosChart data={series.ingresos_6m} />}
            {tieneImpresoras && <EstadoFlotaChart data={impresorasPorEstado} />}
          </div>
        )}

        {showRow3 && (
          <div className="grid gap-6 lg:grid-cols-2">
            {tieneFlujoCaja && series && <FlujoCajaChart data={series.flujo_caja_6m} />}
            {tieneRentabilidad && series && (
              <TopProfitabilityCard
                title="Rentabilidad Top 5"
                printers={series.top_rentabilidad}
                viewReportText="Ver reporte"
                onViewReportClick={() => navigate('/finanzas/rentabilidad')}
              />
            )}
          </div>
        )}

        {showRow4 && (
          <div className="grid gap-6 lg:grid-cols-2">
            {tieneCalendario && (
              <PendingTasksList
                title="Próximas visitas"
                subtitle={`${visitasProximasTasks.length} visita(s) en los próximos 7 días`}
                tasks={visitasProximasTasks}
                viewAllText="Ver calendario"
                onViewAllClick={() => navigate('/operaciones/visitas')}
              />
            )}
            {tieneFacturas && (
              <PendingTasksList
                title="Facturas vencidas"
                subtitle={`${kpis?.facturas_vencidas ?? 0} factura(s) vencida(s)`}
                tasks={facturasVencidasTasks}
                viewAllText="Ver facturas"
                onViewAllClick={() => navigate('/finanzas/facturas')}
              />
            )}
          </div>
        )}

        {showRow5 && (
          <div className="grid gap-6 lg:grid-cols-3">
            {tieneArticulos && (
              <AlertCard
                type={stockBajoCount > 0 ? 'warning' : 'success'}
                title="Stock bajo"
                message={
                  stockBajoCount > 0
                    ? `${stockBajoCount} artículo(s) en stock bajo (${kpis?.stock_critico ?? 0} críticos)`
                    : 'Todos los artículos por encima del umbral'
                }
                action="Ver artículos"
                onActionClick={() => navigate('/inventario/articulos')}
              />
            )}
            {tieneCuentasPagar && (
              <AlertCard
                type={(kpis?.compras_vencidas ?? 0) > 0 ? 'error' : comprasPorVencer.length > 0 ? 'warning' : 'success'}
                title="Compras por vencer"
                message={
                  comprasPorVencer.length > 0
                    ? `${kpis?.compras_por_vencer ?? 0} compra(s) por vencer esta semana (${kpis?.compras_vencidas ?? 0} vencidas)`
                    : 'Sin compras próximas a vencer'
                }
                action={tieneCompras ? 'Ver compras' : undefined}
                onActionClick={tieneCompras ? () => navigate('/finanzas/compras') : undefined}
              />
            )}
            {tieneMantenimiento && (
              <AlertCard
                type={mantenimientosPendientes.length > 0 ? 'warning' : 'success'}
                title="Mantenimientos pendientes"
                message={
                  mantenimientosPendientes.length > 0
                    ? `${kpis?.mantenimientos_pendientes ?? 0} orden(es) programadas`
                    : 'Sin mantenimientos pendientes'
                }
                action="Ver mantenimientos"
                onActionClick={() => navigate('/inventario/mantenimiento')}
              />
            )}
          </div>
        )}
      </div>
    </PageLayout>
  )
}
