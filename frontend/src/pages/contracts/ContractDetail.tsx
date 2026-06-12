import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import PageLayout from '@/components/layout/PageLayout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Modal } from '@/components/ui/Modal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/EmptyState'
import { useContract, useAssignPrinter } from '@/hooks/useContracts'
import { usePrinters } from '@/hooks/usePrinters'
import { useInvoices } from '@/hooks/useInvoices'
import { useVisits } from '@/hooks/useVisits'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  ContractStatus,
  CONTRACT_STATUS_LABELS,
  VisitStatus,
  VISIT_STATUS_LABELS,
  VisitType,
  VISIT_TYPE_LABELS,
  InvoiceStatus,
  INVOICE_STATUS_LABELS,
  PrinterStatus,
  PRINTER_STATUS_LABELS,
} from '@/types/enums'

const contractStatusVariant: Record<ContractStatus, 'success' | 'warning' | 'secondary' | 'error'> = {
  [ContractStatus.ACTIVO]: 'success',
  [ContractStatus.SUSPENDIDO]: 'warning',
  [ContractStatus.FINALIZADO]: 'secondary',
  [ContractStatus.CANCELADO]: 'error',
}

const visitStatusVariant: Record<VisitStatus, 'warning' | 'success' | 'info' | 'error'> = {
  [VisitStatus.PENDIENTE]: 'warning',
  [VisitStatus.COMPLETADA]: 'success',
  [VisitStatus.REPROGRAMADA]: 'info',
  [VisitStatus.CANCELADA]: 'error',
}

const visitTypeVariant: Record<VisitType, 'info' | 'warning' | 'default' | 'error'> = {
  [VisitType.LECTURA]: 'info',
  [VisitType.MANTENIMIENTO]: 'warning',
  [VisitType.INSTALACION]: 'default',
  [VisitType.RETIRO]: 'error',
}

const invoiceStatusVariant: Record<InvoiceStatus, 'warning' | 'info' | 'success' | 'error' | 'secondary'> = {
  [InvoiceStatus.PENDIENTE]: 'warning',
  [InvoiceStatus.PARCIALMENTE_PAGADA]: 'info',
  [InvoiceStatus.PAGADA]: 'success',
  [InvoiceStatus.VENCIDA]: 'error',
  [InvoiceStatus.INCOBRABLE]: 'secondary',
}

const FREQUENCY_LABELS: Record<string, string> = {
  MENSUAL: 'Mensual',
  QUINCENAL: 'Quincenal',
  SEMANAL: 'Semanal',
  CUSTOM: 'Personalizada',
}

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('impresoras')
  const [showAssign, setShowAssign] = useState(false)

  const contractId = Number(id)
  const { data: contract, isLoading, error, refetch } = useContract(contractId)
  const assignMutation = useAssignPrinter()
  const { data: availablePrinters } = usePrinters(
    showAssign ? { estado: PrinterStatus.EN_ALMACEN, per_page: 100 } : undefined
  )
  const { data: visitsData } = useVisits(
    contract ? { contrato_id: contract.id, per_page: 100 } : undefined
  )
  const { data: invoicesData } = useInvoices(
    contract ? { contrato_id: contract.id, per_page: 100 } : undefined
  )

  const releaseMutation = useMutation({
    mutationFn: ({ contractId, printerId }: { contractId: number; printerId: number }) =>
      api.post(`/contracts/${contractId}/release-printer`, { impresora_id: printerId }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
      queryClient.invalidateQueries({ queryKey: ['printers'] })
    },
  })

  if (isLoading) return <PageLayout><LoadingSpinner text="Cargando contrato..." /></PageLayout>
  if (error) return <PageLayout><ErrorMessage message="Error al cargar contrato" onRetry={() => refetch()} /></PageLayout>
  if (!contract) return <PageLayout><EmptyState title="Contrato no encontrado" /></PageLayout>

  const printers = contract.printers ?? []
  const visits = visitsData?.data ?? contract.visits ?? []
  const invoices = invoicesData?.data ?? []

  return (
    <PageLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Contrato {contract.codigo_negocio}</h1>
          <Button variant="outline" onClick={() => navigate('/contratos')}>
            Volver
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Informacion del Contrato</CardTitle>
              <Badge variant={contractStatusVariant[contract.estado]}>
                {CONTRACT_STATUS_LABELS[contract.estado]}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium cursor-pointer text-primary hover:underline" onClick={() => navigate(`/clientes/${contract.cliente_id}`)}>
                  {contract.client?.razon_social ?? `Cliente #${contract.cliente_id}`}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Fecha Inicio</p>
                <p className="font-medium">{formatDate(contract.fecha_inicio)}</p>
              </div>
              {contract.fecha_fin && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Fecha Fin</p>
                  <p className="font-medium">{formatDate(contract.fecha_fin)}</p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Frecuencia Visitas</p>
                <p className="font-medium">{FREQUENCY_LABELS[contract.frecuencia_visitas] ?? contract.frecuencia_visitas}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Dias Gracia</p>
                <p className="font-medium">{contract.dias_gracia}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Dias Adelanto</p>
                <p className="font-medium">{contract.dias_adelanto}</p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Formula de Facturacion</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-sm text-muted-foreground">Tarifa Base</p>
                  <p className="text-lg font-bold">{formatCurrency(contract.tarifa_base)}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-sm text-muted-foreground">Paginas Incluidas</p>
                  <p className="text-lg font-bold">{contract.paginas_incluidas}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-sm text-muted-foreground">Costo Pag. Excedente</p>
                  <p className="text-lg font-bold">{formatCurrency(contract.costo_pag_excedente)}</p>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {formatCurrency(contract.tarifa_base)} + (paginas consumidas - {contract.paginas_incluidas}) x {formatCurrency(contract.costo_pag_excedente)} si excede
              </p>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="impresoras">Impresoras Asignadas</TabsTrigger>
            <TabsTrigger value="visitas">Visitas</TabsTrigger>
            <TabsTrigger value="facturas">Facturas</TabsTrigger>
          </TabsList>

          <TabsContent value="impresoras">
            <div className="flex items-center justify-between mt-4 mb-2">
              <p className="text-sm text-muted-foreground">{printers.length} impresora(s) asignada(s)</p>
              {contract.estado === ContractStatus.ACTIVO && (
                <Button size="sm" onClick={() => setShowAssign(true)}>
                  Asignar Impresora
                </Button>
              )}
            </div>
            {printers.length === 0 ? (
              <EmptyState title="Sin impresoras" description="No hay impresoras asignadas a este contrato" />
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Codigo</TableHead>
                      <TableHead>Marca / Modelo</TableHead>
                      <TableHead>Num. Serie</TableHead>
                      <TableHead>Contador</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {printers.map((printer) => (
                      <TableRow key={printer.id}>
                        <TableCell className="font-medium">{printer.codigo_negocio}</TableCell>
                        <TableCell>{printer.marca} {printer.modelo}</TableCell>
                        <TableCell>{printer.num_serie}</TableCell>
                        <TableCell>{printer.contador_actual}</TableCell>
                        <TableCell>
                          <Button
                            variant="destructive"
                            size="sm"
                            loading={releaseMutation.isPending}
                            onClick={(e) => {
                              e.stopPropagation()
                              releaseMutation.mutate({ contractId: contract.id, printerId: printer.id })
                            }}
                          >
                            Liberar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="visitas">
            {visits.length === 0 ? (
              <EmptyState title="Sin visitas" description="No hay visitas registradas para este contrato" />
            ) : (
              <div className="rounded-lg border mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Socio</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visits.map((visit) => (
                      <TableRow
                        key={visit.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/visitas/${visit.id}`)}
                      >
                        <TableCell>{formatDate(visit.fecha_programada)}</TableCell>
                        <TableCell>
                          <Badge variant={visitTypeVariant[visit.tipo_visita]}>
                            {VISIT_TYPE_LABELS[visit.tipo_visita]}
                          </Badge>
                        </TableCell>
                        <TableCell>{visit.socio?.nombre ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={visitStatusVariant[visit.estado]}>
                            {VISIT_STATUS_LABELS[visit.estado]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="facturas">
            {invoices.length === 0 ? (
              <EmptyState title="Sin facturas" description="No hay facturas registradas para este contrato" />
            ) : (
              <div className="rounded-lg border mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Numero</TableHead>
                      <TableHead>Emision</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Saldo</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.numero_factura}</TableCell>
                        <TableCell>{formatDate(invoice.fecha_emision)}</TableCell>
                        <TableCell>{formatDate(invoice.fecha_vencimiento)}</TableCell>
                        <TableCell>{formatCurrency(invoice.monto_total)}</TableCell>
                        <TableCell>{formatCurrency(invoice.saldo_pendiente)}</TableCell>
                        <TableCell>
                          <Badge variant={invoiceStatusVariant[invoice.estado]}>
                            {INVOICE_STATUS_LABELS[invoice.estado]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AssignPrinterModal
        isOpen={showAssign}
        onClose={() => setShowAssign(false)}
        printers={availablePrinters?.data ?? []}
        onAssign={(printerId) => {
          assignMutation.mutate(
            { id: contract.id, impresora_id: printerId },
            { onSuccess: () => setShowAssign(false) }
          )
        }}
        loading={assignMutation.isPending}
      />
    </PageLayout>
  )
}

interface AssignPrinterModalProps {
  isOpen: boolean
  onClose: () => void
  printers: Array<{ id: number; codigo_negocio: string; marca: string; modelo: string; num_serie: string }>
  onAssign: (printerId: number) => void
  loading: boolean
}

function AssignPrinterModal({ isOpen, onClose, printers, onAssign, loading }: AssignPrinterModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Asignar Impresora">
      {printers.length === 0 ? (
        <EmptyState title="Sin impresoras disponibles" description="No hay impresoras en almacen para asignar" />
      ) : (
        <div className="space-y-3 max-h-96 overflow-auto">
          {printers.map((printer) => (
            <div key={printer.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{printer.codigo_negocio}</p>
                <p className="text-sm text-muted-foreground">
                  {printer.marca} {printer.modelo} — {printer.num_serie}
                </p>
              </div>
              <Button size="sm" loading={loading} onClick={() => onAssign(printer.id)}>
                Asignar
              </Button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
