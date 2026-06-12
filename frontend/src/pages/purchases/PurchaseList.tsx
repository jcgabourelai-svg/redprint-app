import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { usePurchases } from '@/hooks/usePurchases'
import { useSuppliers } from '@/hooks/useSuppliers'
import { useReceivePurchase } from '@/hooks/usePurchases'
import { PurchaseStatus, PURCHASE_STATUS_LABELS } from '@/types/enums'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/EmptyState'
import { TablePagination } from '@/components/ui/TablePagination'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { formatCurrency, formatDate } from '@/lib/utils'

const statusBadgeVariant: Record<string, 'default' | 'success' | 'warning'> = {
  PENDIENTE: 'warning',
  RECIBIDA: 'success',
  CANCELADA: 'default',
}

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  ...Object.values(PurchaseStatus).map((s) => ({
    value: s,
    label: PURCHASE_STATUS_LABELS[s],
  })),
]

export default function PurchaseList() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')

  const params: Record<string, string | number> = { page }
  if (statusFilter) params.estado = statusFilter
  if (supplierFilter) params.proveedor_id = supplierFilter

  const { data, isLoading, isError, refetch } = usePurchases(params)
  const { data: suppliersData } = useSuppliers({ page: 1, per_page: 100 })
  const receiveMutation = useReceivePurchase()

  const supplierOptions = [
    { value: '', label: 'Todos los proveedores' },
    ...(suppliersData?.data.map((s) => ({
      value: String(s.id),
      label: s.razon_social,
    })) ?? []),
  ]

  const handleReceive = (id: number) => {
    receiveMutation.mutate(id)
  }

  if (isLoading) {
    return <LoadingSpinner className="py-20" text="Cargando compras..." />
  }

  if (isError) {
    return <ErrorMessage message="Error al cargar las compras" onRetry={() => refetch()} />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Compras</h1>
        <Button onClick={() => navigate('/compras/nueva')}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Compra
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          options={statusOptions}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          className="w-full sm:w-48"
        />
        <Select
          options={supplierOptions}
          value={supplierFilter}
          onChange={(e) => {
            setSupplierFilter(e.target.value)
            setPage(1)
          }}
          className="w-full sm:w-56"
        />
      </div>

      {!data?.data.length ? (
        <EmptyState title="Sin compras" description="No se encontraron compras con los filtros seleccionados" />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead className="text-right">Monto Total</TableHead>
                <TableHead className="text-right">Monto Pagado</TableHead>
                <TableHead className="text-right">Saldo Pendiente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((purchase) => (
                <TableRow
                  key={purchase.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/compras/${purchase.id}`)}
                >
                  <TableCell>{formatDate(purchase.fecha)}</TableCell>
                  <TableCell>{purchase.supplier?.razon_social ?? `#${purchase.proveedor_id}`}</TableCell>
                  <TableCell className="font-medium">{purchase.concepto}</TableCell>
                  <TableCell className="text-right">{formatCurrency(purchase.monto_total)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(purchase.monto_pagado)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(purchase.saldo_pendiente)}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant[purchase.estado] ?? 'default'}>
                      {PURCHASE_STATUS_LABELS[purchase.estado as PurchaseStatus] ?? purchase.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {purchase.estado === PurchaseStatus.PENDIENTE && (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={receiveMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleReceive(purchase.id)
                        }}
                      >
                        Recibir
                      </Button>
                    )}
                  </TableCell>
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
    </div>
  )
}
