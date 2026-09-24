import { useNavigate } from 'react-router-dom'
import {
  Wrench,
  AlertTriangle,
  ClipboardList,
  PackageCheck,
  PackageOpen,
  HelpCircle,
  Timer,
  CheckCircle2,
  DollarSign,
  Plus,
  CalendarClock,
} from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { useTallerDashboard } from '@/hooks/useTaller'
import { useUpcomingPlans } from '@/hooks/useMaintenancePlans'
import { formatCurrency } from '@/lib/formatters'
import { severityLabels, severityBadgeVariant } from '@/lib/maintenanceProblem'
import { printerConditionLabels } from '@/lib/printerCondition'

const estadoLabels: Record<string, string> = {
  EN_ALMACEN: 'En almacén',
  RENTADA: 'Rentada',
  EN_MANTENIMIENTO: 'En taller',
}

const condicionColumnas = ['OPERATIVA', 'REQUIERE_ATENCION', 'NO_OPERATIVA', 'PIEZAS', 'sin_condicion'] as const

export default function TallerDashboard() {
  const navigate = useNavigate()
  const { data, isLoading } = useTallerDashboard()
  const { data: preventivos } = useUpcomingPlans()

  if (isLoading || !data) {
    return (
      <PageLayout title="Inventario › Taller">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    )
  }

  const { kpis, cola, sin_orden: sinOrden, matriz_estado_condicion: matriz, piezas_bajo_umbral: piezas, productividad_mes: productividad } = data

  const kpiCards = [
    { label: 'No operativas', value: kpis.no_operativas, icon: AlertTriangle, className: 'bg-destructive/10 text-destructive' },
    { label: 'Requieren atención', value: kpis.requiere_atencion, icon: HelpCircle, className: 'bg-warning/10 text-warning' },
    { label: 'En taller', value: kpis.en_taller, icon: Wrench, className: 'bg-primary/10 text-primary' },
    { label: 'Disponibles para renta', value: kpis.disponibles_renta, icon: PackageCheck, className: 'bg-success/10 text-success' },
    { label: 'Donantes de piezas', value: kpis.para_piezas, icon: PackageOpen, className: 'bg-muted text-muted-foreground' },
    { label: 'Sin condición', value: kpis.sin_condicion, icon: HelpCircle, className: 'bg-muted text-muted-foreground' },
  ]

  return (
    <PageLayout title="Inventario › Taller">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Taller</h2>
          <p className="text-sm text-muted-foreground">
            Estado técnico de la flota y cola de trabajo (se actualiza cada 5 minutos)
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {kpiCards.map((kpi) => {
            const Icon = kpi.icon
            return (
              <Card key={kpi.label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${kpi.className}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{kpi.label}</p>
                      <p className="text-lg font-bold">{kpi.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  <CardTitle>Cola del taller</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {cola.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">No hay órdenes programadas</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Orden</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Impresora</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Ubicación</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Tipo</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Severidad</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Antigüedad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cola.map((item) => {
                          const hoy = new Date().toISOString().split('T')[0]
                          const vencida = !!item.fecha && item.fecha < hoy
                          return (
                          <tr
                            key={item.orden_id}
                            className="border-b border-border cursor-pointer hover:bg-muted/50"
                            onClick={() => navigate(`/inventario/mantenimiento/${item.orden_id}`)}
                          >
                            <td className="px-4 py-2 font-medium">
                              #{item.orden_id}
                              {vencida && (
                                <span className="block text-destructive text-xs font-normal">objetivo vencido</span>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <p>
                                {item.impresora?.marca} {item.impresora?.modelo}
                              </p>
                              <p className="text-xs text-muted-foreground">{item.impresora?.codigo ?? '-'}</p>
                            </td>
                            <td className="px-4 py-2">
                              {item.ubicacion?.lugar === 'PISO' ? (
                                <Badge variant="warning" className="max-w-[12rem]">
                                  <span className="truncate">En piso · {item.ubicacion.cliente ?? 's/cliente'}</span>
                                </Badge>
                              ) : item.ubicacion?.lugar === 'TALLER' ? (
                                <Badge variant="neutral" className="max-w-[12rem]">
                                  <span className="truncate">En taller · {item.ubicacion.almacen ?? 's/almacén'}</span>
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <Badge variant={item.tipo_mantto === 'PREVENTIVO' ? 'primary' : 'warning'}>
                                {item.tipo_mantto ?? '-'}
                              </Badge>
                            </td>
                            <td className="px-4 py-2">
                              {item.severidad ? (
                                <Badge variant={severityBadgeVariant(item.severidad)}>{severityLabels[item.severidad] ?? item.severidad}</Badge>
                              ) : (
                                <span className="text-muted-foreground">Sin severidad</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <span className={item.dias_desde_creacion >= 7 ? 'font-medium text-destructive' : ''}>
                                {item.dias_desde_creacion} día{item.dias_desde_creacion === 1 ? '' : 's'}
                              </span>
                            </td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <CardTitle>Sin orden abierta</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {sinOrden.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">
                      No hay impresoras no operativas sin orden de mantenimiento
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {sinOrden.map((p) => (
                      <div key={p.id} className="flex items-center justify-between px-4 py-2">
                        <div>
                          <p className="text-sm font-medium">
                            {p.marca} {p.modelo}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.codigo ?? '-'} · #{p.id}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/inventario/mantenimiento/crear?impresora=${p.id}`)}
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          Crear orden
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-primary" />
                  <CardTitle>Matriz estado × condición</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                        {condicionColumnas.map((c) => (
                          <th key={c} className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">
                            {c === 'sin_condicion' ? 'Sin condición' : printerConditionLabels[c]}
                          </th>
                        ))}
                        <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matriz.map((fila) => (
                        <tr key={fila.estado} className="border-b border-border">
                          <td className="px-4 py-2 font-medium">{estadoLabels[fila.estado] ?? fila.estado}</td>
                          {condicionColumnas.map((c) => (
                            <td key={c} className="px-4 py-2 text-right tabular-nums">
                              {fila[c] ?? 0}
                            </td>
                          ))}
                          <td className="px-4 py-2 text-right font-medium tabular-nums">{fila.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <CardTitle>Productividad del mes</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Completadas</p>
                    <p className="text-lg font-bold">{productividad.completadas_mes}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Timer className="h-3 w-3" /> MTTR (días)
                    </p>
                    <p className="text-lg font-bold">{productividad.mttr_dias}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">% correctivas</p>
                    <p className="text-lg font-bold">{productividad.pct_correctivas}%</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> Costo del mes
                    </p>
                    <p className="text-lg font-bold">{formatCurrency(productividad.costo_mes)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-5 w-5 text-primary" />
                    <CardTitle>Preventivos</CardTitle>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/inventario/mantenimiento/planes')}
                  >
                    Ver bandeja
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {preventivos === undefined ? (
                  <p className="text-sm text-muted-foreground">Cargando...</p>
                ) : preventivos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin preventivos vencidos ni próximos</p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-4 text-sm">
                      <span className="text-destructive font-medium">
                        {preventivos.filter((p) => p.estado === 'VENCIDO').length} vencidos
                      </span>
                      <span className="text-warning font-medium">
                        {preventivos.filter((p) => p.estado === 'PROXIMO').length} próximos
                      </span>
                    </div>
                    <div className="space-y-1">
                      {preventivos.slice(0, 5).map((p) => (
                        <button
                          key={`${p.plan_id}-${p.impresora_id}`}
                          type="button"
                          onClick={() => navigate(`/inventario/impresoras/${p.impresora_id}`)}
                          className="block w-full text-left text-xs text-muted-foreground hover:text-foreground"
                        >
                          {p.impresora.marca} {p.impresora.modelo} —{' '}
                          {p.estado === 'VENCIDO'
                            ? p.dias_restantes !== null
                              ? `vencido hace ${Math.abs(p.dias_restantes)} días`
                              : 'vencido'
                            : p.dias_restantes !== null
                              ? `en ${p.dias_restantes} días`
                              : 'próximo'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <PackageOpen className="h-5 w-5 text-warning" />
                  <CardTitle>Piezas bajo umbral</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {piezas.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">Stock de reparación suficiente</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {piezas.map((a) => (
                      <div key={a.id} className="flex items-center justify-between px-4 py-2">
                        <p className="text-sm truncate">{a.nombre}</p>
                        <span className="text-sm font-medium whitespace-nowrap ml-2">
                          {a.stock_actual} / {a.stock_minimo}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
