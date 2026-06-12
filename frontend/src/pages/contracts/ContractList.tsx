import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { TablePagination } from '@/components/ui/TablePagination'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/EmptyState'
import { useContracts } from '@/hooks/useContracts'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ContractStatus, CONTRACT_STATUS_LABELS } from '@/types/enums'

const contractStatusVariant: Record<ContractStatus, 'success' | 'warning' | 'secondary' | 'error'> = {
  [ContractStatus.ACTIVO]: 'success',
  [ContractStatus.SUSPENDIDO]: 'warning',
  [ContractStatus.FINALIZADO]: 'secondary',
  [ContractStatus.CANCELADO]: 'error',
}

const statusOptions = [
  { value: '', label: 'Todos' },
  { value: ContractStatus.ACTIVO, label: 'Activo' },
  { value: ContractStatus.SUSPENDIDO, label: 'Suspendido' },
  { value: ContractStatus.FINALIZADO, label: 'Finalizado' },
  { value: ContractStatus.CANCELADO, label: 'Cancelado' },
]

export default function ContractList() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')

  const params: Record<string, string | number> = { page, per_page: 15 }
  if (statusFilter) params.estado = statusFilter

  const { data, isLoading, error, refetch } = useContracts(params)

  const contracts = data?.data ?? []
  const totalPages = data?.last_page ?? 1

  return (
    <PageLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold">Contratos</h1>
          <Button onClick={() => navigate('/contratos/nuevo')}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Contrato
          </Button>
        </div>

        <div className="max-w-xs">
          <Select
            id="status-filter"
            label="Filtrar por Estado"
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          />
        </div>

        {isLoading && <LoadingSpinner text="Cargando contratos..." />}
        {error && <ErrorMessage message="Error al cargar contratos" onRetry={() => refetch()} />}

        {!isLoading && !error && contracts.length === 0 && (
          <EmptyState
            title="No hay contratos"
            description="Crea un nuevo contrato para comenzar"
            actionLabel="Nuevo Contrato"
            onAction={() => navigate('/contratos/nuevo')}
          />
        )}

        {!isLoading && !error && contracts.length > 0 && (
          <>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Codigo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Fecha Inicio</TableHead>
                    <TableHead>Tarifa Base</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Impresoras</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((contract) => (
                    <TableRow
                      key={contract.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/contratos/${contract.id}`)}
                    >
                      <TableCell className="font-medium">{contract.codigo_negocio}</TableCell>
                      <TableCell>{contract.client?.razon_social ?? '—'}</TableCell>
                      <TableCell>{formatDate(contract.fecha_inicio)}</TableCell>
                      <TableCell>{formatCurrency(contract.tarifa_base)}</TableCell>
                      <TableCell>
                        <Badge variant={contractStatusVariant[contract.estado]}>
                          {CONTRACT_STATUS_LABELS[contract.estado]}
                        </Badge>
                      </TableCell>
                      <TableCell>{contract.printers?.length ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <TablePagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </PageLayout>
  )
}
