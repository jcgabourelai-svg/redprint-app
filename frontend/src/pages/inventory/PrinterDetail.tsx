import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Edit, PowerOff } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { usePrinter, useUpdatePrinter } from '@/hooks/usePrinters'
import { useReadingsByPrinter } from '@/hooks/useReadings'
import { formatDate, formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Toast, useToast } from '@/components/ui/Toast'
import { PRINTER_STATUS_LABELS, PrinterStatus } from '@/types/enums'
import type { PrinterHistoryEntry } from '@/types/models'
import PrinterForm from './PrinterForm'

const statusBadgeVariant: Record<string, 'success' | 'info' | 'warning' | 'error'> = {
  EN_ALMACEN: 'info',
  RENTADA: 'success',
  EN_MANTENIMIENTO: 'warning',
  DADA_DE_BAJA: 'error',
}

export default function PrinterDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addToast } = useToast()
  const isAdmin = user?.rol === 'ADMIN'
  const printerId = Number(id)

  const [activeTab, setActiveTab] = useState('info')
  const [formOpen, setFormOpen] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)

  const { data: printer, isLoading, isError, refetch } = usePrinter(printerId)
  const updatePrinter = useUpdatePrinter()

  const { data: historyData } = useQuery<{ data: PrinterHistoryEntry[] }>({
    queryKey: ['printers', printerId, 'history'],
    queryFn: () => api.get(`/printers/${printerId}/history`).then((r) => r.data),
    enabled: activeTab === 'historial' && !!printerId,
  })

  const { data: readingsData } = useReadingsByPrinter(printerId)

  const handleDeactivate = async () => {
    try {
      await updatePrinter.mutateAsync({
        id: printerId,
        estado: PrinterStatus.DADA_DE_BAJA,
      })
      addToast('Impresora dada de baja', 'success')
      refetch()
    } catch {
      addToast('Error al dar de baja la impresora', 'error')
    }
  }

  if (isLoading) {
    return <LoadingSpinner className="py-20" text="Cargando impresora..." />
  }

  if (isError || !printer) {
    return <ErrorMessage message="Error al cargar la impresora" onRetry={() => refetch()} />
  }

  const infoFields = [
    { label: 'Codigo', value: printer.codigo_negocio },
    { label: 'Marca', value: printer.marca },
    { label: 'Modelo', value: printer.modelo },
    { label: 'No. Serie', value: printer.num_serie },
    { label: 'Estado', value: null },
    { label: 'Almacen', value: printer.warehouse?.nombre ?? '-' },
    { label: 'Fecha Adquisicion', value: formatDate(printer.fecha_adquisicion) },
    {
      label: 'Costo Adquisicion',
      value: printer.costo_adquisicion != null ? formatCurrency(printer.costo_adquisicion) : '-',
    },
    { label: 'Vida Util (meses)', value: printer.vida_util_meses?.toString() ?? '-' },
    { label: 'Contador Actual', value: printer.contador_actual.toLocaleString() },
    { label: 'Creado Por', value: printer.creator?.nombre ?? '-' },
    { label: 'Fecha Creacion', value: formatDate(printer.fecha_creacion) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{printer.codigo_negocio}</h1>
          <p className="text-muted-foreground">
            {printer.marca} {printer.modelo}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setFormOpen(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
            {printer.estado !== PrinterStatus.DADA_DE_BAJA && (
              <Button variant="destructive" onClick={() => setDeactivateOpen(true)}>
                <PowerOff className="mr-2 h-4 w-4" />
                Dar de Baja
              </Button>
            )}
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="info">Informacion</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="lecturas">Lecturas</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>Datos de la Impresora</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {infoFields.map((field) => (
                  <div key={field.label}>
                    <p className="text-sm text-muted-foreground">{field.label}</p>
                    {field.label === 'Estado' ? (
                      <Badge variant={statusBadgeVariant[printer.estado]}>
                        {PRINTER_STATUS_LABELS[printer.estado]}
                      </Badge>
                    ) : (
                      <p className="font-medium">{field.value}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historial">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Eventos</CardTitle>
            </CardHeader>
            <CardContent>
              {!historyData?.data?.length ? (
                <EmptyState title="Sin historial" description="No hay eventos registrados para esta impresora" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo Evento</TableHead>
                      <TableHead>Descripcion</TableHead>
                      <TableHead>Socio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData.data.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatDate(entry.fecha)}</TableCell>
                        <TableCell>{entry.tipo_evento}</TableCell>
                        <TableCell>{entry.descripcion ?? '-'}</TableCell>
                        <TableCell>{entry.socio?.nombre ?? '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lecturas">
          <Card>
            <CardHeader>
              <CardTitle>Lecturas del Contador</CardTitle>
            </CardHeader>
            <CardContent>
              {!readingsData?.data?.length ? (
                <EmptyState title="Sin lecturas" description="No hay lecturas registradas para esta impresora" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Valor Contador</TableHead>
                      <TableHead className="text-right">Paginas Periodo</TableHead>
                      <TableHead>Anomalia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readingsData.data.map((reading) => (
                      <TableRow key={reading.id}>
                        <TableCell>{formatDate(reading.fecha)}</TableCell>
                        <TableCell className="text-right">{reading.valor_contador.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{reading.paginas_periodo.toLocaleString()}</TableCell>
                        <TableCell>
                          {reading.es_anomalia ? (
                            <Badge variant="error">Si</Badge>
                          ) : (
                            <Badge variant="success">No</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PrinterForm
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        printer={printer}
      />

      <ConfirmDialog
        isOpen={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        onConfirm={handleDeactivate}
        title="Dar de Baja Impresora"
        message="¿Estas seguro de dar de baja esta impresora? Esta accion no se puede deshacer."
        confirmLabel="Dar de Baja"
        variant="destructive"
      />
    </div>
  )
}
