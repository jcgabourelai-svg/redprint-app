import { useState } from 'react'
import { useReadings } from '@/hooks/useReadings'
import { usePrinters } from '@/hooks/usePrinters'
import { useContracts } from '@/hooks/useContracts'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { TablePagination } from '@/components/ui/TablePagination'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate } from '@/lib/utils'
import type { Reading } from '@/types/models'

export default function ReadingListPage() {
  const [page, setPage] = useState(1)
  const [printerId, setPrinterId] = useState('')
  const [contractId, setContractId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const params: Record<string, string | number> = { page }
  if (printerId) params.impresora_id = printerId
  if (contractId) params.contrato_id = contractId
  if (dateFrom) params.fecha_desde = dateFrom
  if (dateTo) params.fecha_hasta = dateTo

  const { data, isLoading, isError, refetch } = useReadings(params)
  const { data: printersData } = usePrinters({ per_page: 100 })
  const { data: contractsData } = useContracts({ per_page: 100 })

  const printerOptions = (printersData?.data ?? []).map((p) => ({
    value: String(p.id),
    label: `${p.marca} ${p.modelo} - ${p.codigo_negocio}`,
  }))

  const contractOptions = (contractsData?.data ?? []).map((c) => ({
    value: String(c.id),
    label: c.codigo_negocio,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lecturas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historial de lecturas de contadores
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-4">
        <h3 className="font-medium">Filtros</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Select
            label="Impresora"
            options={printerOptions}
            placeholder="Todas"
            value={printerId}
            onChange={(e) => { setPrinterId(e.target.value); setPage(1) }}
          />
          <Select
            label="Contrato"
            options={contractOptions}
            placeholder="Todos"
            value={contractId}
            onChange={(e) => { setContractId(e.target.value); setPage(1) }}
          />
          <Input
            label="Desde"
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
          />
          <Input
            label="Hasta"
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
          />
        </div>
      </div>

      {isLoading && <LoadingSpinner text="Cargando lecturas..." />}
      {isError && <ErrorMessage message="Error al cargar lecturas" onRetry={() => refetch()} />}

      {data && !isLoading && (
        <>
          {data.data.length === 0 ? (
            <EmptyState title="Sin lecturas" description="No se encontraron lecturas con los filtros aplicados" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Impresora</TableHead>
                    <TableHead>Valor Contador</TableHead>
                    <TableHead>Paginas Periodo</TableHead>
                    <TableHead>Anomalia</TableHead>
                    <TableHead>Socio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((reading: Reading) => (
                    <TableRow key={reading.id}>
                      <TableCell>{formatDate(reading.fecha)}</TableCell>
                      <TableCell>
                        {reading.printer
                          ? `${reading.printer.marca} ${reading.printer.modelo}`
                          : `#${reading.impresora_id}`}
                      </TableCell>
                      <TableCell>{reading.valor_contador.toLocaleString()}</TableCell>
                      <TableCell>{reading.paginas_periodo.toLocaleString()}</TableCell>
                      <TableCell>
                        {reading.es_anomalia ? (
                          <Badge variant="error">Si</Badge>
                        ) : (
                          <Badge variant="success">No</Badge>
                        )}
                      </TableCell>
                      <TableCell>{reading.socio?.nombre ?? `#${reading.socio_id}`}</TableCell>
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
        </>
      )}
    </div>
  )
}
