import { useState, useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftRight, ArrowDown, ArrowUp } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Table from '@/components/ui/Table'
import type { Column } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import { Card, CardContent } from '@/components/ui/Card'
import api from '@/lib/api'
import { useServerTable } from '@/hooks/useServerTable'
import { formatDate, formatDateTime } from '@/lib/formatters'
import type { InventoryMovement } from '@/types/inventory-movement'
import type { MovementType } from '@/types/enums'

const referenciaTipoLabel: Record<string, string> = {
  INVENTARIO_INICIAL: 'Inventario inicial',
  MANTENIMIENTO: 'Mantenimiento',
  AJUSTE: 'Ajuste',
  COMPRA: 'Compra',
  compra: 'Compra',
}

function referenciaLink(t: string | null, id: number | null): string | null {
  if (!id) return null
  const k = (t ?? '').toUpperCase()
  if (k === 'COMPRA') return `/finanzas/compras/${id}`
  if (k === 'MANTENIMIENTO') return `/inventario/mantenimiento/${id}`
  return null
}

function tipoVariant(t: MovementType): 'success' | 'warning' | 'info' {
  return t === 'ENTRADA' ? 'success' : t === 'SALIDA' ? 'warning' : 'info'
}

function deltaColorClass(delta: number): string {
  return delta > 0 ? 'text-success' : delta < 0 ? 'text-warning' : 'text-muted-foreground'
}

export default function MovementList() {
  const navigate = useNavigate()
  const [tipoFilter, setTipoFilter] = useState('')
  const [selected, setSelected] = useState<InventoryMovement | null>(null)
  const { data: movements, tableProps, isLoading, error } = useServerTable<InventoryMovement>({
    queryKey: ['inventory-movements'],
    fetcher: (p) => api.get('/inventory-movements', { params: p }).then((r) => r.data),
    defaultSort: { column: 'fecha', dir: 'desc' },
    extraParams: { tipo_movimiento: tipoFilter || undefined },
  })

  const totalMovements = tableProps.totalItems ?? 0
  const entradas = movements.filter((m) => m.tipo_movimiento === 'ENTRADA').length
  const salidas = movements.filter((m) => m.tipo_movimiento === 'SALIDA').length

  const columns: Column<InventoryMovement>[] = [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
    },
    {
      key: 'article',
      label: 'Artículo',
      render: (_value, row) => (
        <div>
          <p className="font-medium text-foreground">{row.article?.nombre ?? '—'}</p>
          <p className="text-xs text-muted-foreground">#{row.articulo_id}</p>
        </div>
      ),
    },
    {
      key: 'tipo_movimiento',
      label: 'Tipo',
      sortable: true,
      render: (value: string) => <Badge variant={tipoVariant(value as MovementType)}>{value}</Badge>,
    },
    {
      key: 'cantidad',
      label: 'Cantidad',
      sortable: true,
      render: (value: number, row) => {
        const color =
          row.tipo_movimiento === 'ENTRADA'
            ? 'text-success'
            : row.tipo_movimiento === 'SALIDA'
              ? 'text-warning'
              : 'text-foreground'
        return <span className={`font-medium ${color}`}>{value} uds</span>
      },
    },
    {
      key: 'stock_posterior',
      label: 'Stock',
      render: (_value, row) => {
        const delta = row.stock_posterior - row.stock_anterior
        return (
          <span className="tabular-nums">
            {row.stock_anterior} → {row.stock_posterior}
            <span className={`ml-1 text-xs ${deltaColorClass(delta)}`}>
              ({delta > 0 ? '+' : ''}{delta})
            </span>
          </span>
        )
      },
    },
    {
      key: 'origen',
      label: 'Origen',
      render: (_value, row) => {
        const label = row.referencia_tipo
          ? (referenciaTipoLabel[row.referencia_tipo] ?? row.referencia_tipo)
          : '—'
        const link = referenciaLink(row.referencia_tipo, row.referencia_id)
        if (link) {
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                navigate(link)
              }}
              className="text-left text-primary hover:underline"
            >
              {label}
            </button>
          )
        }
        return <span className="text-muted-foreground">{label}</span>
      },
    },
    {
      key: 'socio',
      label: 'Responsable',
      render: (_value, row) => row.socio?.nombre ?? '—',
    },
    {
      key: 'fecha',
      label: 'Fecha',
      sortable: true,
      render: (value: string) => formatDate(value),
    },
  ]

  if (isLoading) {
    return (
      <PageLayout title="Inventario › Movimientos" showSearch>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Inventario › Movimientos" showSearch>
        <div className="flex items-center justify-center h-64">
          <p className="text-destructive">Error al cargar movimientos</p>
        </div>
      </PageLayout>
    )
  }

  const hasFilters = !!tipoFilter
  const clearFilters = () => setTipoFilter('')

  return (
    <PageLayout title="Inventario › Movimientos" showSearch>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Movimientos de Inventario</h2>
          <p className="text-sm text-muted-foreground">
            Registro de auditoría inmutable de entradas, salidas y ajustes de stock
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <ArrowLeftRight className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Movimientos</p>
                  <p className="text-lg font-bold">{totalMovements}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-success/10 p-2">
                  <ArrowDown className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Entradas (página)</p>
                  <p className="text-lg font-bold text-success">{entradas}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-warning/10 p-2">
                  <ArrowUp className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Salidas (página)</p>
                  <p className="text-lg font-bold text-warning">{salidas}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-44">
            <Select
              options={[
                { value: '', label: 'Todos los tipos' },
                { value: 'ENTRADA', label: 'Entrada' },
                { value: 'SALIDA', label: 'Salida' },
                { value: 'AJUSTE', label: 'Ajuste' },
              ]}
              value={tipoFilter}
              onChange={setTipoFilter}
              placeholder="Filtrar por tipo"
            />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          )}
        </div>

        <Table
          data={movements}
          columns={columns}
          searchable={true}
          sortable={true}
          paginatable={true}
          onRowClick={(row) => setSelected(row)}
          {...tableProps}
          emptyMessage="No hay movimientos registrados"
        />

        <p className="text-xs text-muted-foreground">
          Mostrando {movements.length} movimientos en la página. Las tarjetas de Entradas/Salidas
          reflejan solo la página actual, no el total global.
        </p>
      </div>

      <MovementDetailModal
        movement={selected}
        onClose={() => setSelected(null)}
        onNavigate={navigate}
      />
    </PageLayout>
  )
}

function MovementDetailModal({
  movement,
  onClose,
  onNavigate,
}: {
  movement: InventoryMovement | null
  onClose: () => void
  onNavigate: (path: string) => void
}) {
  const [snapshot, setSnapshot] = useState(movement)
  useEffect(() => {
    if (movement) setSnapshot(movement)
  }, [movement])
  const m = movement ?? snapshot

  const delta = m ? m.stock_posterior - m.stock_anterior : 0
  const origenLabel = m?.referencia_tipo
    ? (referenciaTipoLabel[m.referencia_tipo] ?? m.referencia_tipo)
    : '—'
  const origenLink = m ? referenciaLink(m.referencia_tipo, m.referencia_id) : null

  return (
    <Modal isOpen={!!movement} onClose={onClose} title="Detalle del Movimiento" size="lg">
      {m && (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant={tipoVariant(m.tipo_movimiento)}>{m.tipo_movimiento}</Badge>
          <span className="text-xs text-muted-foreground">Movimiento #{m.id}</span>
        </div>

        <dl className="divide-y divide-border rounded-md border border-border">
          <DetailRow label="Artículo">
            <div>
              <p className="font-medium text-foreground">{m.article?.nombre ?? '—'}</p>
              <p className="text-xs text-muted-foreground">
                {m.article?.modelo_sku ? `SKU: ${m.article.modelo_sku}` : `ID: #${m.articulo_id}`}
              </p>
            </div>
          </DetailRow>
          <DetailRow label="Cantidad">
            <span className="font-medium">{m.cantidad} uds</span>
          </DetailRow>
          <DetailRow label="Stock">
            <span className="tabular-nums">
              <span className="text-muted-foreground">{m.stock_anterior}</span>
              {' → '}
              <span className="font-medium">{m.stock_posterior}</span>
              <span className={`ml-2 text-sm ${deltaColorClass(delta)}`}>
                ({delta > 0 ? '+' : ''}{delta})
              </span>
            </span>
          </DetailRow>
          <DetailRow label="Origen">
            {origenLink ? (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onNavigate(origenLink)
                }}
                className="text-primary hover:underline"
              >
                {origenLabel} →
              </button>
            ) : (
              <span className="text-muted-foreground">{origenLabel}</span>
            )}
          </DetailRow>
          <DetailRow label="Justificación">
            <span className="text-muted-foreground">{m.justificacion || '—'}</span>
          </DetailRow>
          <DetailRow label="Responsable">
            <span className="text-muted-foreground">{m.socio?.nombre ?? '—'}</span>
          </DetailRow>
          <DetailRow label="Fecha">
            <span className="text-muted-foreground">{formatDate(m.fecha)}</span>
          </DetailRow>
          <DetailRow label="Registrado el">
            <span className="text-muted-foreground">{formatDateTime(m.fecha_creacion)}</span>
          </DetailRow>
        </dl>

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
      )}
    </Modal>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-right">{children}</dd>
    </div>
  )
}
