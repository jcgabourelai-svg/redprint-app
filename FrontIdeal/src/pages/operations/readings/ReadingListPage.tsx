import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Table from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import type { Reading } from '@/types/reading'
import { useReadings } from '@/hooks/useReadings'
import { formatDate } from '@/lib/formatters'
import { parseApiError } from '@/lib/api-errors'

interface ReadingWithClient extends Reading {
  clienteNombre: string
}

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

  const { data: readingsData, isLoading, error } = useReadings({
    socio_capturista: socioFilter || undefined,
    fecha_inicio: fechaInicio || undefined,
    fecha_fin: fechaFin || undefined,
  })

  const readings = readingsData?.data || []

  const clearFilters = () => {
    setSocioFilter('')
    setFechaInicio('')
    setFechaFin('')
  }

  if (isLoading) {
    return (
      <PageLayout title="Operaciones › Lecturas">
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Cargando lecturas...</p>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Operaciones › Lecturas">
        <div className="flex items-center justify-center py-12">
          <p className="text-red-500">{parseApiError(error)}</p>
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
          className="p-1 hover:bg-gray-100 rounded"
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
          <h2 className="text-2xl font-bold text-gray-900">Lecturas</h2>
          <p className="text-sm text-gray-500">Historial de lecturas de contador registradas</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="w-full sm:w-48">
            <label className="block text-xs font-medium text-gray-500 mb-1">Socio capturista</label>
            <Select
              options={sociosOptions}
              value={socioFilter}
              onChange={setSocioFilter}
              placeholder="Todos"
            />
          </div>
          <div className="w-full sm:w-44">
            <label className="block text-xs font-medium text-gray-500 mb-1">Fecha inicio</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="w-full sm:w-44">
            <label className="block text-xs font-medium text-gray-500 mb-1">Fecha fin</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            Limpiar filtros
          </button>
        </div>

        <Table
          data={readings}
          columns={columns}
          searchable={true}
          sortable={true}
          paginatable={true}
          pageSize={25}
          emptyMessage="No se encontraron lecturas con los filtros aplicados"
          onRowClick={(reading) => navigate(`/operaciones/visitas/${reading.visita_id}`)}
        />
      </div>
    </PageLayout>
  )
}