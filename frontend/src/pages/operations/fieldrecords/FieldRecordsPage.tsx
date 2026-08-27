import { useState } from 'react'
import { ClipboardList } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Table from '@/components/ui/Table'
import EmptyState from '@/components/ui/EmptyState'
import Select from '@/components/ui/Select'
import Toast from '@/components/ui/Toast'
import Button from '@/components/ui/Button'
import api from '@/lib/api'
import FieldRecordDetailModal from '@/components/fieldrecords/FieldRecordDetailModal'
import LinkFieldRecordModal from '@/components/fieldrecords/LinkFieldRecordModal'
import DiscardFieldRecordModal from '@/components/fieldrecords/DiscardFieldRecordModal'
import { FieldRecordEstadoBadge, FieldRecordTipoBadge } from '@/components/fieldrecords/FieldRecordBadges'
import { useFieldRecords, usePendingFieldRecordsCount } from '@/hooks/useFieldRecords'
import { useSocios } from '@/hooks/useVisits'
import { useTienePermiso } from '@/contexts/AuthContext'
import { useServerTable } from '@/hooks/useServerTable'
import { formatDateTime } from '@/lib/formatters'
import { parseApiError } from '@/lib/api-errors'
import {
  FieldRecordStatus,
  FieldRecordStatusLabels,
  FieldRecordType,
  FieldRecordTypeLabels,
} from '@/types/enums'
import type { FieldRecord } from '@/types/field-record'

export default function FieldRecordsPage() {
  const [estadoFilter, setEstadoFilter] = useState('PENDIENTE')
  const [tipoFilter, setTipoFilter] = useState('')
  const [socioFilter, setSocioFilter] = useState('')
  const [detalle, setDetalle] = useState<FieldRecord | null>(null)
  const [linkRecord, setLinkRecord] = useState<FieldRecord | null>(null)
  const [discardRecord, setDiscardRecord] = useState<FieldRecord | null>(null)
  const [toast, setToast] = useState<{ open: boolean; variant: 'success' | 'error'; message: string }>({
    open: false,
    variant: 'success',
    message: '',
  })
  const notify = (variant: 'success' | 'error', message: string) =>
    setToast({ open: true, variant, message })

  const tieneCalendario = useTienePermiso('operaciones.calendario')
  const { data: sociosData } = useSocios(tieneCalendario)

  const { data: pendingCount } = usePendingFieldRecordsCount()

  const { data: records, tableProps, isLoading, error, hasActiveFilters, raw } = useServerTable<FieldRecord>({
    queryKey: ['field-records'],
    fetcher: (p) => api.get('/field-records', { params: p }).then((r) => r.data),
    defaultSort: { column: 'capturado_en', dir: 'desc' },
    extraParams: {
      estado: estadoFilter || undefined,
      tipo: tipoFilter || undefined,
      socio_id: socioFilter || undefined,
    },
  })

  const clearFilters = () => {
    setEstadoFilter('')
    setTipoFilter('')
    setSocioFilter('')
  }

  const hasLocalFilters = !!estadoFilter || !!tipoFilter || !!socioFilter
  const isVirginEmpty = records.length === 0 && !hasActiveFilters && !hasLocalFilters
  const pendientes = pendingCount?.meta?.total ?? 0

  if (isLoading) {
    return (
      <PageLayout title="Operaciones › Registros de campo">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Cargando registros de campo...</p>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Operaciones › Registros de campo">
        <div className="flex items-center justify-center py-12">
          <p className="text-destructive">{parseApiError(error)}</p>
        </div>
      </PageLayout>
    )
  }

  const columns = [
    {
      key: 'capturado_en',
      label: 'Capturado',
      sortable: true,
      render: (value: string) => formatDateTime(value),
    },
    {
      key: 'tipo',
      label: 'Tipo',
      render: (_value: string | undefined, row: FieldRecord) => <FieldRecordTipoBadge tipo={row.tipo} />,
    },
    {
      key: 'nombre_cliente_reportado',
      label: 'Cliente reportado',
      render: (value: string, row: FieldRecord) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{value}</p>
          {row.cliente_id && (
            <p className="text-xs text-muted-foreground">Vinculado a cliente #{row.cliente_id}</p>
          )}
        </div>
      ),
    },
    {
      key: 'num_serie_reportado',
      label: 'Serie reportada',
      render: (value: string | null | undefined) => value ?? '-',
    },
    {
      key: 'valor_contador',
      label: 'Contador',
      render: (value: number | null | undefined, row: FieldRecord) =>
        row.tipo === FieldRecordType.LECTURA
          ? (value ?? 0).toLocaleString('es-MX')
          : '-',
    },
    {
      key: 'socio_nombre',
      label: 'Socio',
      render: (value: string | null | undefined, row: FieldRecord) => value ?? `#${row.socio_id}`,
    },
    {
      key: 'estado',
      label: 'Estado',
      render: (_value: string | undefined, row: FieldRecord) => (
        <FieldRecordEstadoBadge estado={row.estado} />
      ),
    },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (_value: unknown, row: FieldRecord) =>
        row.estado === FieldRecordStatus.PENDIENTE ? (
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              setLinkRecord(row)
            }}
          >
            Regularizar
          </Button>
        ) : null,
    },
  ]

  const sociosOptions = [
    { value: '', label: 'Todos' },
    ...(sociosData ?? []).map((s) => ({ value: String(s.id), label: s.nombre })),
  ]

  return (
    <PageLayout title="Operaciones › Registros de campo">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Registros de campo</h2>
            <p className="text-sm text-muted-foreground">
              Visitas no catalogadas capturadas por los operadores desde la app móvil, en espera de
              regularización
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3 text-center shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">Pendientes de regularizar</p>
            <p className={`mt-1 text-2xl font-bold ${pendientes > 0 ? 'text-warning' : 'text-foreground'}`}>
              {pendientes}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="w-full sm:w-44">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Estado</label>
            <Select
              options={[
                { value: '', label: 'Todos' },
                ...Object.entries(FieldRecordStatusLabels).map(([value, label]) => ({ value, label })),
              ]}
              value={estadoFilter}
              onChange={setEstadoFilter}
              placeholder="Todos"
            />
          </div>
          <div className="w-full sm:w-48">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo</label>
            <Select
              options={[
                { value: '', label: 'Todos' },
                ...Object.entries(FieldRecordTypeLabels).map(([value, label]) => ({ value, label })),
              ]}
              value={tipoFilter}
              onChange={setTipoFilter}
              placeholder="Todos"
            />
          </div>
          {tieneCalendario && (
            <div className="w-full sm:w-48">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Socio</label>
              <Select
                options={sociosOptions}
                value={socioFilter}
                onChange={setSocioFilter}
                placeholder="Todos"
              />
            </div>
          )}
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          >
            Limpiar filtros
          </button>
        </div>

        {isVirginEmpty ? (
          <EmptyState
            icon={ClipboardList}
            title="Sin registros de campo"
            description="Los operadores capturan registros de campo desde la app móvil (http://localhost:8080/m/) cuando el cliente o la impresora no están en sistema. Los registros aparecerán aquí para su regularización."
          />
        ) : (
          <Table
            data={records}
            columns={columns}
            searchable={false}
            sortable={true}
            paginatable={true}
            {...tableProps}
            emptyMessage={
              hasLocalFilters || hasActiveFilters
                ? 'No se encontraron registros con los filtros aplicados.'
                : undefined
            }
            onRowClick={(record) => setDetalle(record)}
          />
        )}

        {raw && raw.meta && (
          <p className="text-xs text-muted-foreground">
            {raw.meta.total} registro(s) en total
          </p>
        )}
      </div>

      <FieldRecordDetailModal
        record={detalle}
        isOpen={detalle !== null}
        onClose={() => setDetalle(null)}
        onVincular={(record) => {
          setDetalle(null)
          setLinkRecord(record)
        }}
        onDescartar={(record) => {
          setDetalle(null)
          setDiscardRecord(record)
        }}
      />

      <LinkFieldRecordModal
        record={linkRecord}
        isOpen={linkRecord !== null}
        onClose={() => setLinkRecord(null)}
        onSuccess={(mensaje) => notify('success', mensaje)}
        onError={(mensaje) => notify('error', mensaje)}
      />

      <DiscardFieldRecordModal
        record={discardRecord}
        isOpen={discardRecord !== null}
        onClose={() => setDiscardRecord(null)}
        onSuccess={(mensaje) => notify('success', mensaje)}
        onError={(mensaje) => notify('error', mensaje)}
      />

      <Toast
        isOpen={toast.open}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        variant={toast.variant}
        message={toast.message}
      />
    </PageLayout>
  )
}
