import { useNavigate } from 'react-router-dom'
import { Plus, Wrench, ClipboardList, CheckCircle2, DollarSign, AlertTriangle, RotateCcw } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Table from '@/components/ui/Table'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { Card, CardContent } from '@/components/ui/Card'
import api from '@/lib/api'
import { useServerTable } from '@/hooks/useServerTable'
import { useMaintenanceStats } from '@/hooks/useMaintenanceOrders'
import { formatDate, formatCurrency } from '@/lib/formatters'
import { problemTypeLabels, severityLabels, severityBadgeVariant } from '@/lib/maintenanceProblem'
import { useIsAdmin } from '@/contexts/AuthContext'
import type { MaintenanceOrder } from '@/types/maintenance-order'

const estadoOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'PROGRAMADA', label: 'Programada' },
  { value: 'COMPLETADA', label: 'Completada' },
  { value: 'CANCELADA', label: 'Cancelada' },
]

const tipoOptions = [
  { value: '', label: 'Todos los tipos' },
  { value: 'PREVENTIVO', label: 'Preventivo' },
  { value: 'CORRECTIVO', label: 'Correctivo' },
]

const severidadOptions = [
  { value: '', label: 'Todas las severidades' },
  ...Object.entries(severityLabels).map(([value, label]) => ({ value, label })),
]

const tipoProblemaOptions = [
  { value: '', label: 'Todos los problemas' },
  ...Object.entries(problemTypeLabels).map(([value, label]) => ({ value, label })),
]

export default function MaintenanceList() {
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const { data: orders, tableProps, isLoading, error, hasActiveFilters } = useServerTable<MaintenanceOrder>({
    queryKey: ['maintenance-orders'],
    fetcher: (p) => api.get('/maintenance-orders', { params: p }).then((r) => r.data),
    defaultSort: { column: 'fecha', dir: 'desc' },
  })

  const { data: stats } = useMaintenanceStats()

  const setFilter = (key: string, value: string) =>
    tableProps.onFilterChange({ ...tableProps.filterState, [key]: value })

  const activeFilters = Object.values(tableProps.filterState || {}).some((v) => v !== '' && v != null)

  const columns = [
    {
      key: 'id',
      label: 'Orden',
      sortable: true,
    },
    {
      key: 'impresora_id',
      label: 'Impresora',
      sortable: true,
      render: (_value: string, row: any) => (
        <div>
          <p className="font-medium">{row.printer?.marca} {row.printer?.modelo}</p>
          <p className="text-xs text-muted-foreground">{row.socio?.nombre}</p>
        </div>
      ),
    },
    {
      key: 'fecha',
      label: 'Fecha',
      sortable: true,
      render: (value: string) => formatDate(value),
    },
    {
      key: 'tipo_mantto',
      label: 'Tipo',
      sortable: true,
      render: (value: string) => (
        <Badge variant={value === 'PREVENTIVO' ? 'primary' : 'warning'}>
          {value === 'PREVENTIVO' ? 'PREVENTIVO' : 'CORRECTIVO'}
        </Badge>
      ),
    },
    {
      key: 'tipo_problema',
      label: 'Problema',
      sortable: true,
      render: (_value: string, row: any) => {
        if (!row.tipo_problema && !row.severidad) {
          return <span className="text-muted-foreground">-</span>
        }
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {row.tipo_problema && (
              <span className="text-sm">
                {problemTypeLabels[row.tipo_problema] ?? row.tipo_problema}
              </span>
            )}
            {row.severidad && (
              <Badge
                variant={severityBadgeVariant(row.severidad)}
                className={row.severidad === 'CRITICA' ? 'ring-2 ring-red-300' : ''}
              >
                {severityLabels[row.severidad] ?? row.severidad}
              </Badge>
            )}
          </div>
        )
      },
    },
    {
      key: 'desc_problema',
      label: 'Descripción',
      render: (value: string) => (
        <p className="text-sm text-muted-foreground max-w-xs truncate">{value || '-'}</p>
      ),
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      render: (value: string) => (
        <Badge variant="document_status" color={value}>
          {value.replace(/_/g, ' ').toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'costo_mano_obra',
      label: 'Costo',
      sortable: true,
      render: (value: number) => formatCurrency(value),
    },
  ]

  if (isLoading) {
    return (
      <PageLayout title="Inventario › Mantenimiento" showSearch>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Inventario › Mantenimiento" showSearch>
        <div className="flex items-center justify-center h-64">
          <p className="text-destructive">Error al cargar órdenes de mantenimiento</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Inventario › Mantenimiento" showSearch>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Órdenes de Mantenimiento</h2>
            <p className="text-sm text-muted-foreground">Gestión de servicios de mantenimiento</p>
          </div>
          {isAdmin && (
            <Button onClick={() => navigate('/inventario/mantenimiento/crear')}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Orden
            </Button>
          )}
        </div>

        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <ClipboardList className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Abiertas</p>
                    <p className="text-lg font-bold">{stats.abiertas}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-success/10 p-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Completadas del mes</p>
                    <p className="text-lg font-bold">{stats.completadas_mes}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-success/10 p-2">
                    <DollarSign className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Costo del mes</p>
                    <p className="text-lg font-bold">{formatCurrency(stats.costo_mes)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-warning/10 p-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">% Correctivas</p>
                    <p className="text-lg font-bold">{stats.pct_correctivas}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex items-end gap-3 flex-wrap">
          <div className="w-44">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Estado</label>
            <Select
              options={estadoOptions}
              value={tableProps.filterState.estado || ''}
              onChange={(v) => setFilter('estado', v)}
              placeholder="Estado"
            />
          </div>
          <div className="w-40">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo</label>
            <Select
              options={tipoOptions}
              value={tableProps.filterState.tipo_mantto || ''}
              onChange={(v) => setFilter('tipo_mantto', v)}
              placeholder="Tipo"
            />
          </div>
          <div className="w-44">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Severidad</label>
            <Select
              options={severidadOptions}
              value={tableProps.filterState.severidad || ''}
              onChange={(v) => setFilter('severidad', v)}
              placeholder="Severidad"
            />
          </div>
          <div className="w-48">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Problema</label>
            <Select
              options={tipoProblemaOptions}
              value={tableProps.filterState.tipo_problema || ''}
              onChange={(v) => setFilter('tipo_problema', v)}
              placeholder="Problema"
            />
          </div>
          <div className="w-40">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Desde</label>
            <Input
              type="date"
              value={tableProps.filterState.fecha_desde || ''}
              onChange={(e) => setFilter('fecha_desde', e.target.value)}
            />
          </div>
          <div className="w-40">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Hasta</label>
            <Input
              type="date"
              value={tableProps.filterState.fecha_hasta || ''}
              onChange={(e) => setFilter('fecha_hasta', e.target.value)}
            />
          </div>
          {activeFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => tableProps.onFilterChange({})}
            >
              <RotateCcw className="mr-1 h-4 w-4" />
              Limpiar filtros
            </Button>
          )}
        </div>

        {orders.length === 0 && !hasActiveFilters ? (
          <EmptyState
            icon={Wrench}
            title="No hay órdenes de mantenimiento"
            description="Crea una orden para registrar el mantenimiento de una impresora."
            action={
              isAdmin
                ? { label: 'Nueva Orden', onClick: () => navigate('/inventario/mantenimiento/crear') }
                : undefined
            }
          />
        ) : (
          <Table
            data={orders}
            columns={columns}
            searchable={true}
            sortable={true}
            paginatable={true}
            {...tableProps}
            emptyMessage="No se encontraron órdenes de mantenimiento con los filtros aplicados."
            onRowClick={(order) => navigate(`/inventario/mantenimiento/${order.id}`)}
          />
        )}
      </div>
    </PageLayout>
  )
}
