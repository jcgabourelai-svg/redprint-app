import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Printer as PrinterIcon, Plus } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Table, { type FilterConfig } from '@/components/ui/Table'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import PrinterForm, { type PrinterFormData } from '@/components/printer/PrinterForm'
import api from '@/lib/api'
import { useCreatePrinter } from '@/hooks/usePrinters'
import { useServerTable } from '@/hooks/useServerTable'
import { formatCurrency, formatDate, getPrinterStatusColor } from '@/lib/formatters'
import { useIsAdmin } from '@/contexts/AuthContext'
import type { Printer } from '@/types/printer'

const PRINTER_FILTERS: FilterConfig[] = [
  {
    key: 'estado',
    label: 'Estado',
    options: [
      { label: 'En almacén', value: 'EN_ALMACEN' },
      { label: 'Rentada', value: 'RENTADA' },
      { label: 'En mantenimiento', value: 'EN_MANTENIMIENTO' },
      { label: 'Dada de baja', value: 'DADA_DE_BAJA' },
    ],
  },
]

export default function PrinterList() {
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const { data: printers, tableProps, isLoading, error, hasActiveFilters } = useServerTable<Printer>({
    queryKey: ['printers'],
    fetcher: (p) => api.get('/printers', { params: p }).then((r) => r.data),
  })
  const createMutation = useCreatePrinter()

  const handleCreate = useCallback(
    async (data: PrinterFormData) => {
      try {
        await createMutation.mutateAsync(data)
        setShowCreateModal(false)
      } catch {
        setCreateError('No se pudo crear la impresora. Verifica los datos e intenta nuevamente.')
      }
    },
    [createMutation]
  )

  const columns = [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
    },
    {
      key: 'modelo',
      label: 'Modelo',
      sortable: true,
      render: (_value: string, row: any) => (
        <div>
          <p className="font-medium">{row.marca} {_value}</p>
          <p className="text-xs text-muted-foreground">SERIE: {row.num_serie}</p>
          <p className="text-xs text-muted-foreground">COSTO: {formatCurrency(row.costo_adquisicion ?? 0)}</p>
        </div>
      ),
    },
    {
      key: 'estado',
      label: 'Estado',
      sortable: true,
      render: (value: string) => (
        <Badge variant="printer_status" color={value}>
          {(value || '').replace(/_/g, ' ').toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'codigo_negocio',
      label: 'Ubicación',
      sortable: true,
      render: (_value: string, row: any) => (
        <div>
          <p>{row.codigo_negocio}</p>
          {row.warehouse && (
            <p className="text-xs text-muted-foreground">ALMACÉN: {row.warehouse.nombre || row.warehouse.id}</p>
          )}
        </div>
      ),
    },
    {
      key: 'contador_actual',
      label: 'Contador',
      sortable: true,
      render: (value: number) => (
        <span className="tabular-nums">{(value ?? 0).toLocaleString('es-MX')}</span>
      ),
    },
  ]

  if (isLoading) {
    return (
      <PageLayout title="Inventario › Impresoras" showSearch>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Inventario › Impresoras" showSearch>
        <div className="flex items-center justify-center h-64">
          <p className="text-destructive">Error al cargar impresoras</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Inventario › Impresoras" showSearch>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Impresoras</h2>
            <p className="text-sm text-muted-foreground">Gestión de impresoras del negocio</p>
          </div>
          {isAdmin && (
            <Button onClick={() => { setShowCreateModal(true); setCreateError(null) }}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Impresora
            </Button>
          )}
        </div>

        {printers.length === 0 && !hasActiveFilters ? (
          <EmptyState
            icon={PrinterIcon}
            title="No hay impresoras"
            description="Comienza registrando tu primera impresora para gestionar el inventario."
            action={
              isAdmin
                ? { label: 'Nueva Impresora', onClick: () => { setShowCreateModal(true); setCreateError(null) } }
                : undefined
            }
          />
        ) : (
          <Table
            data={printers}
            columns={columns}
            filters={PRINTER_FILTERS}
            searchable={true}
            sortable={true}
            paginatable={true}
            {...tableProps}
            emptyMessage="No se encontraron impresoras con los filtros aplicados."
            onRowClick={(printer) => navigate(`/inventario/impresoras/${printer.id}`)}
          />
        )}
      </div>

      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); setCreateError(null) }}
        title="Nueva Impresora"
        size="lg"
      >
        {createError && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {createError}
          </div>
        )}
        <PrinterForm
          onSubmit={handleCreate}
          onCancel={() => { setShowCreateModal(false); setCreateError(null) }}
          loading={createMutation.isPending}
        />
      </Modal>
    </PageLayout>
  )
}
