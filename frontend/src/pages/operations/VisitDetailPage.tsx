import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/EmptyState'
import { useVisit, useCompleteVisit, useRescheduleVisit } from '@/hooks/useVisits'
import { formatDate } from '@/lib/utils'
import {
  VisitStatus,
  VISIT_STATUS_LABELS,
  VisitType,
  VISIT_TYPE_LABELS,
} from '@/types/enums'

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

export default function VisitDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [showReschedule, setShowReschedule] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [showCancel, setShowCancel] = useState(false)

  const visitId = Number(id)
  const { data: visit, isLoading, error, refetch } = useVisit(visitId)
  const completeMutation = useCompleteVisit()
  const rescheduleMutation = useRescheduleVisit()

  if (isLoading) return <LoadingSpinner text="Cargando visita..." />
  if (error) return <ErrorMessage message="Error al cargar visita" onRetry={() => refetch()} />
  if (!visit) return <EmptyState title="Visita no encontrada" />

  const readings = visit.readings ?? []
  const isPending = visit.estado === VisitStatus.PENDIENTE

  const handleComplete = () => {
    completeMutation.mutate({ id: visit.id }, {
      onSuccess: () => refetch(),
    })
  }

  const handleReschedule = () => {
    if (!newDate) return
    rescheduleMutation.mutate(
      { id: visit.id, fecha_programada: newDate },
      {
        onSuccess: () => {
          setShowReschedule(false)
          setNewDate('')
          refetch()
        },
      }
    )
  }

  return (
    <>
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Visita #{visit.id}</h1>
          <Button variant="outline" onClick={() => navigate('/calendario')}>
            Volver
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Informacion de la Visita</CardTitle>
              <Badge variant={visitStatusVariant[visit.estado]}>
                {VISIT_STATUS_LABELS[visit.estado]}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p
                  className="font-medium text-primary hover:underline cursor-pointer"
                  onClick={() => navigate(`/clientes/${visit.cliente_id}`)}
                >
                  {visit.client?.razon_social ?? `Cliente #${visit.cliente_id}`}
                </p>
              </div>
              {visit.contrato_id && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Contrato</p>
                  <p
                    className="font-medium text-primary hover:underline cursor-pointer"
                    onClick={() => navigate(`/contratos/${visit.contrato_id}`)}
                  >
                    {visit.contract?.codigo_negocio ?? `Contrato #${visit.contrato_id}`}
                  </p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Tipo</p>
                <Badge variant={visitTypeVariant[visit.tipo_visita]}>
                  {VISIT_TYPE_LABELS[visit.tipo_visita]}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Fecha Programada</p>
                <p className="font-medium">{formatDate(visit.fecha_programada)}</p>
              </div>
              {visit.fecha_realizada && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Fecha Realizada</p>
                  <p className="font-medium">{formatDate(visit.fecha_realizada)}</p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Socio Asignado</p>
                <p className="font-medium">{visit.socio?.nombre ?? '—'}</p>
              </div>
            </div>
            {visit.notas && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">Notas</p>
                <p className="mt-1 text-sm">{visit.notas}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lecturas</CardTitle>
          </CardHeader>
          <CardContent>
            {readings.length === 0 ? (
              <EmptyState title="No hay lecturas" description="No se han registrado lecturas para esta visita" />
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Impresora</TableHead>
                      <TableHead>Valor Contador</TableHead>
                      <TableHead>Paginas Periodo</TableHead>
                      <TableHead>Anomalia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readings.map((reading) => (
                      <TableRow key={reading.id}>
                        <TableCell className="font-medium">
                          {reading.printer?.codigo_negocio ?? `#${reading.impresora_id}`}
                        </TableCell>
                        <TableCell>{reading.valor_contador}</TableCell>
                        <TableCell>{reading.paginas_periodo}</TableCell>
                        <TableCell>
                          {reading.es_anomalia ? (
                            <Badge variant="error">Anomalia</Badge>
                          ) : (
                            <Badge variant="success">Normal</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {isPending && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleComplete}
                  loading={completeMutation.isPending}
                >
                  Completar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowReschedule(true)}
                >
                  Reprogramar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowCancel(true)}
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Modal isOpen={showReschedule} onClose={() => setShowReschedule(false)} title="Reprogramar Visita">
        <div className="space-y-4">
          <Input
            id="new-date"
            label="Nueva Fecha"
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowReschedule(false)}>
              Cancelar
            </Button>
            <Button onClick={handleReschedule} loading={rescheduleMutation.isPending} disabled={!newDate}>
              Reprogramar
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={() => {
          rescheduleMutation.mutate(
            { id: visit.id, estado: 'CANCELADA' },
            { onSuccess: () => refetch() }
          )
        }}
        title="Cancelar Visita"
        message="¿Estas seguro de que deseas cancelar esta visita? Esta accion no se puede deshacer."
        confirmLabel="Cancelar Visita"
        cancelLabel="Volver"
        variant="destructive"
      />
    </>
  )
}
