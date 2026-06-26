import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Table from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import type { Reading } from '@/types/reading'
import api from '@/lib/api'
import { useServerTable } from '@/hooks/useServerTable'
import { formatDate } from '@/lib/formatters'
import { parseApiError } from '@/lib/api-errors'

const sociosOptions = [
  { value: '', label: 'Todos' },
  { value: 'Maria Lopez', label: 'María López' },
  { value: 'Carlos Gomez', label: 'Carlos Gómez' },
  { value: 'Juan Perez', label: 'Juan Pérez' },
]

export default function ReadingListPage() {
  const navigate = useNavigate()
  const [socioFilter, setSocioFilter] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')

  const { data: readings, tableProps, isLoading, error } = useServerTable<Reading>({
    queryKey: ['readings'],
    fetcher: (p) => api.get('/readings', { params: p }).then((r) => r.data),
    defaultSort: { column: 'fecha', dir: 'desc' },
    extraParams: {
      socio_capturista: socioFilter || undefined,
      fecha_inicio: fechaInicio || undefined,
      fecha_fin: fechaFin || undefined,
    },
  })

  const clearFilters = () => {
    setSocioFilter('')
    setFechaInicio('')
    setFechaFin('')
  }

  if (isLoading) {
    return (
      <PageLayout title="Operaciones › Lecturas">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Cargando lecturas...</p>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Operaciones › Lecturas">
        <div className="flex items-center justify-center py-12">
          <p className="text-destructive">{parseApiError(error)}</p>
        </div>
      </PageLayout>
    )
  }

  const columns = [
    {
      key: 'fecha',
      label: 'Fecha',
      sortable: true,
      render: (value: string) => formatDate(value),
    },
    {
      key: 'impresora_nombre',
      label: 'Impresora',
    },
    {
      key: 'lectura_anterior',
      label: 'Lectura Anterior',
      render: (value: number | null | undefined) => (
        <span className="tabular-nums">{(value ?? 0).toLocaleString('es-MX')}</span>
      ),
    },
    {
      key: 'lectura_actual',
      label: 'Lectura Actual',
      render: (value: number | null | undefined) => (
        <span className="tabular-nums">{(value ?? 0).toLocaleString('es-MX')}</span>
      ),
    },
    {
      key: 'paginas_consumidas',
      label: 'Páginas',
      sortable: true,
      render: (value: number | null | undefined) => (
        <span className="tabular-nums">{(value ?? 0).toLocaleString('es-MX')}</span>
      ),
    },
    {
      key: 'socio_capturista',
      label: 'Socio',
    },
    {
      key: 'excepcion',
      label: 'Estado',
      render: (_value: string | undefined, row: Reading) => (
        <Badge variant={row.excepcion ? 'error' : 'success'}>
          {row.excepcion ? 'Anómala' : 'Normal'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (_value: unknown, row: Reading) => (
        <button
          className="p-1 hover:bg-muted rounded"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/operaciones/visitas/${row.visita_id}`)
          }}
        >
          <Eye className="h-4 w-4" />
        </button>
      ),
    },
  ]

  return (
    <PageLayout title="Operaciones › Lecturas">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Lecturas</h2>
          <p className="text-sm text-muted-foreground">Historial de lecturas de contador registradas</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="w-full sm:w-48">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Socio capturista</label>
            <Select
              options={sociosOptions}
              value={socioFilter}
              onChange={setSocioFilter}
              placeholder="Todos"
            />
          </div>
          <div className="w-full sm:w-44">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Fecha inicio</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="w-full sm:w-44">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Fecha fin</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          >
            Limpiar filtros
          </button>
        </div>

        <Table
          data={readings}
          columns={columns}
          searchable={false}
          sortable={true}
          paginatable={true}
          {...tableProps}
          emptyMessage="No se encontraron lecturas con los filtros aplicados"
          onRowClick={(reading) => navigate(`/operaciones/visitas/${reading.visita_id}`)}
        />
      </div>
    </PageLayout>
  )
}