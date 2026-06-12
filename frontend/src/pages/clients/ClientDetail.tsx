import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Phone, Mail, MapPin } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/EmptyState'
import { useClient } from '@/hooks/useClients'
import { useInvoices } from '@/hooks/useInvoices'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ContractStatus, CONTRACT_STATUS_LABELS } from '@/types/enums'

const contractStatusVariant: Record<ContractStatus, 'success' | 'warning' | 'secondary' | 'error'> = {
  [ContractStatus.ACTIVO]: 'success',
  [ContractStatus.SUSPENDIDO]: 'warning',
  [ContractStatus.FINALIZADO]: 'secondary',
  [ContractStatus.CANCELADO]: 'error',
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('contratos')

  const { data: client, isLoading, error, refetch } = useClient(Number(id))
  const { data: invoicesData } = useInvoices(
    client ? { cliente_id: client.id, per_page: 100 } : undefined
  )

  if (isLoading) return <PageLayout><LoadingSpinner text="Cargando cliente..." /></PageLayout>
  if (error) return <PageLayout><ErrorMessage message="Error al cargar cliente" onRetry={() => refetch()} /></PageLayout>
  if (!client) return <PageLayout><EmptyState title="Cliente no encontrado" /></PageLayout>

  const contracts = client.contracts ?? []
  const pendingInvoices = (invoicesData?.data ?? []).filter(
    (inv) => inv.estado === 'PENDIENTE' || inv.estado === 'VENCIDA'
  )

  return (
    <PageLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{client.razon_social}</h1>
          <Button variant="outline" onClick={() => navigate('/clientes')}>
            Volver
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informacion del Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">RFC</p>
                <p className="font-medium">{client.rfc ?? '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Contacto</p>
                <p className="font-medium">{client.nombre_contacto}</p>
              </div>
              <div className="flex items-center gap-2 space-y-1">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium">{client.telefono}</p>
              </div>
              <div className="flex items-center gap-2 space-y-1">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium">{client.correo ?? '—'}</p>
              </div>
              <div className="flex items-start gap-2 space-y-1">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <p className="font-medium">{client.direccion_instalacion}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Fecha Creacion</p>
                <p className="font-medium">{formatDate(client.fecha_creacion)}</p>
              </div>
            </div>
            {client.notas && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">Notas</p>
                <p className="mt-1 text-sm">{client.notas}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="contratos">Contratos</TabsTrigger>
            <TabsTrigger value="facturas">Facturas Pendientes</TabsTrigger>
          </TabsList>

          <TabsContent value="contratos">
            {contracts.length === 0 ? (
              <EmptyState title="Sin contratos" description="Este cliente no tiene contratos registrados" />
            ) : (
              <div className="rounded-lg border mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Codigo</TableHead>
                      <TableHead>Fecha Inicio</TableHead>
                      <TableHead>Tarifa Base</TableHead>
                      <TableHead>Estado</TableHead>
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
                        <TableCell>{formatDate(contract.fecha_inicio)}</TableCell>
                        <TableCell>{formatCurrency(contract.tarifa_base)}</TableCell>
                        <TableCell>
                          <Badge variant={contractStatusVariant[contract.estado]}>
                            {CONTRACT_STATUS_LABELS[contract.estado]}
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
            {pendingInvoices.length === 0 ? (
              <EmptyState title="Sin facturas pendientes" description="No hay facturas pendientes para este cliente" />
            ) : (
              <div className="rounded-lg border mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Numero</TableHead>
                      <TableHead>Fecha Emision</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead>Monto Total</TableHead>
                      <TableHead>Saldo Pendiente</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.numero_factura}</TableCell>
                        <TableCell>{formatDate(invoice.fecha_emision)}</TableCell>
                        <TableCell>{formatDate(invoice.fecha_vencimiento)}</TableCell>
                        <TableCell>{formatCurrency(invoice.monto_total)}</TableCell>
                        <TableCell>{formatCurrency(invoice.saldo_pendiente)}</TableCell>
                        <TableCell>
                          <Badge variant={invoice.estado === 'VENCIDA' ? 'error' : 'warning'}>
                            {invoice.estado === 'VENCIDA' ? 'Vencida' : 'Pendiente'}
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
    </PageLayout>
  )
}
