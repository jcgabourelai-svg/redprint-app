import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { usePrinters } from '@/hooks/usePrinters'
import { useAuth } from '@/hooks/useAuth'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/EmptyState'
import { TablePagination } from '@/components/ui/TablePagination'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { PRINTER_STATUS_LABELS, PrinterStatus } from '@/types/enums'
import type { Printer } from '@/types/models'
import PrinterForm from './PrinterForm'

const statusBadgeVariant: Record<string, 'success' | 'info' | 'warning' | 'error'> = {
  EN_ALMACEN: 'info',
  RENTADA: 'success',
  EN_MANTENIMIENTO: 'warning',
  DADA_DE_BAJA: 'error',
}

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  ...Object.values(PrinterStatus).map((s) => ({
    value: s,
    label: PRINTER_STATUS_LABELS[s],
  })),
]

export default function PrinterList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.rol === 'ADMIN'

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [brand, setBrand] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingPrinter, setEditingPrinter] = useState<Printer | undefined>(undefined)

  const params: Record<string, string | number> = { page }
  if (search) params.search = search
  if (status) params.estado = status
  if (brand) params.marca = brand

  const { data, isLoading, isError, refetch } = usePrinters(params)

  const handleRowClick = (id: number) => {
    navigate(`/impresoras/${id}`)
  }

  const handleNewPrinter = () => {
    setEditingPrinter(undefined)
    setFormOpen(true)
  }

  if (isLoading) {
    return <LoadingSpinner className="py-20" text="Cargando impresoras..." />
  }

  if (isError) {
    return <ErrorMessage message="Error al cargar las impresoras" onRetry={() => refetch()} />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Impresoras</h1>
        {isAdmin && (
          <Button onClick={handleNewPrinter}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Impresora
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por codigo, modelo o serie..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <Select
          options={statusOptions}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          className="w-full sm:w-48"
        />
        <Input
          placeholder="Marca"
          value={brand}
          onChange={(e) => {
            setBrand(e.target.value)
            setPage(1)
          }}
          className="w-full sm:w-40"
        />
      </div>

      {!data?.data.length ? (
        <EmptyState title="Sin impresoras" description="No se encontraron impresoras con los filtros seleccionados" />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Codigo</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>No. Serie</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Almacen</TableHead>
                <TableHead className="text-right">Contador</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((printer) => (
                <TableRow
                  key={printer.id}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(printer.id)}
                >
                  <TableCell className="font-medium">{printer.codigo_negocio}</TableCell>
                  <TableCell>{printer.marca}</TableCell>
                  <TableCell>{printer.modelo}</TableCell>
                  <TableCell>{printer.num_serie}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant[printer.estado]}>
                      {PRINTER_STATUS_LABELS[printer.estado]}
                    </Badge>
                  </TableCell>
                  <TableCell>{printer.warehouse?.nombre ?? '-'}</TableCell>
                  <TableCell className="text-right">{printer.contador_actual.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <TablePagination
            currentPage={data.current_page}
            totalPages={data.last_page}
            onPageChange={setPage}
          />
        </>
      )}

      <PrinterForm
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        printer={editingPrinter}
      />
    </div>
  )
}
