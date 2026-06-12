import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInvoices } from '@/hooks/useInvoices'
import { InvoiceStatus, INVOICE_STATUS_LABELS } from '@/types/enums'
import type { Invoice } from '@/types/models'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { TablePagination } from '@/components/ui/TablePagination'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency, formatDate } from '@/lib/utils'
import RegisterPaymentPage from './RegisterPaymentPage'

const statusBadgeVariant: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  PENDIENTE: 'warning',
  PARCIALMENTE_PAGADA: 'info',
  PAGADA: 'success',
  VENCIDA: 'error',
  INCOBRABLE: 'error',
}

const statusOptions = [
  { value: '', label: 'Todos' },
  ...Object.values(InvoiceStatus).map((s) => ({
    value: s,
    label: INVOICE_STATUS_LABELS[s],
  })),
]

export default function InvoiceList() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<number | null>(null)

  const params: Record<string, string | number> = { page }
  if (statusFilter) params.estado = statusFilter

  const { data, isLoading, isError, refetch } = useInvoices(params)

  const closeDetail = () => setSelectedInvoice(null)
  const closePayment = () => {
    setPaymentInvoiceId(null)
    refetch()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Facturas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestion de facturas y pagos
          </p>
        </div>
        <Button onClick={() => navigate('/facturas/nueva')}>
          Registrar Factura
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <Select
          label="Estado"
          options={statusOptions}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
        />
      </div>

      {isLoading && <LoadingSpinner text="Cargando facturas..." />}
      {isError && <ErrorMessage message="Error al cargar facturas" onRetry={() => refetch()} />}

      {data && !isLoading && (
        <>
          {data.data.length === 0 ? (
            <EmptyState title="Sin facturas" description="No se encontraron facturas" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Factura</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Fecha Emision</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead className="text-right">Monto Total</TableHead>
                    <TableHead className="text-right">Saldo Pendiente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((invoice: Invoice) => (
                    <TableRow
                      key={invoice.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedInvoice(invoice)}
                    >
                      <TableCell className="font-medium">{invoice.numero_factura}</TableCell>
                      <TableCell>{invoice.client?.razon_social ?? `#${invoice.cliente_id}`}</TableCell>
                      <TableCell>{formatDate(invoice.fecha_emision)}</TableCell>
                      <TableCell>{formatDate(invoice.fecha_vencimiento)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(invoice.monto_total)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(invoice.saldo_pendiente)}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant[invoice.estado] ?? 'default'}>
                          {INVOICE_STATUS_LABELS[invoice.estado]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {invoice.saldo_pendiente > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              setPaymentInvoiceId(invoice.id)
                            }}
                          >
                            Registrar Pago
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
        </>
      )}

      <Modal isOpen={!!selectedInvoice} onClose={closeDetail} title="Detalle de Factura">
        {selectedInvoice && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">No. Factura:</span>
                <p className="font-medium">{selectedInvoice.numero_factura}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Cliente:</span>
                <p className="font-medium">{selectedInvoice.client?.razon_social ?? `#${selectedInvoice.cliente_id}`}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Fecha Emision:</span>
                <p className="font-medium">{formatDate(selectedInvoice.fecha_emision)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Vencimiento:</span>
                <p className="font-medium">{formatDate(selectedInvoice.fecha_vencimiento)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Monto Total:</span>
                <p className="font-medium">{formatCurrency(selectedInvoice.monto_total)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Monto Pagado:</span>
                <p className="font-medium">{formatCurrency(selectedInvoice.monto_pagado)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Saldo Pendiente:</span>
                <p className="font-semibold text-destructive">{formatCurrency(selectedInvoice.saldo_pendiente)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Estado:</span>
                <div className="mt-1">
                  <Badge variant={statusBadgeVariant[selectedInvoice.estado] ?? 'default'}>
                    {INVOICE_STATUS_LABELS[selectedInvoice.estado]}
                  </Badge>
                </div>
              </div>
            </div>

            {selectedInvoice.notas && (
              <div className="text-sm">
                <span className="text-muted-foreground">Notas:</span>
                <p className="mt-1">{selectedInvoice.notas}</p>
              </div>
            )}

            {selectedInvoice.saldo_pendiente > 0 && (
              <Button
                className="w-full"
                onClick={() => {
                  setPaymentInvoiceId(selectedInvoice.id)
                  closeDetail()
                }}
              >
                Registrar Pago
              </Button>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!paymentInvoiceId}
        onClose={closePayment}
        title="Registrar Pago"
        className="max-w-md"
      >
        {paymentInvoiceId && (
          <RegisterPaymentPage invoiceId={paymentInvoiceId} onClose={closePayment} />
        )}
      </Modal>
    </div>
  )
}
