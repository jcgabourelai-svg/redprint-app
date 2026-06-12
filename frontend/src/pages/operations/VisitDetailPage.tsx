import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Edit,
  ClipboardList,
  CheckCircle,
  RefreshCw,
  Trash2,
  Clock,
  User as UserIcon,
  MapPin,
  Printer,
  FileText,
} from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { useVisit, useCompleteVisit, useRescheduleVisit } from '@/hooks/useVisits'
import type { VisitStatus } from '@/types/operations'
import { formatDate } from '@/lib/formatters'
import { parseApiError } from '@/lib/api-errors'
import { useState } from 'react'

const tipoVisitaLabels: Record<string, string> = {
  LECTURA: 'Lectura de contador',
  MANTENIMIENTO: 'Mantenimiento',
  INSTALACION: 'Instalación',
  RETIRO: 'Retiro',
}

const estadoLabels: Record<VisitStatus, string> = {
  PENDIENTE: 'Pendiente',
  COMPLETADA: 'Completada',
  REPROGRAMADA: 'Reprogramada',
  CANCELADA: 'Cancelada',
}

const estadoVariant: Record<VisitStatus, 'primary' | 'success' | 'warning' | 'neutral'> = {
  PENDIENTE: 'primary',
  COMPLETADA: 'success',
  REPROGRAMADA: 'warning',
  CANCELADA: 'neutral',
}

export default function VisitDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const idNum = parseInt(id || '0')
  
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [rescheduleData, setRescheduleData] = useState({ fecha_programada: '', hora_programada: '' })
  
  const { data: visit, isLoading, error } = useVisit(idNum)
  const completeVisit = useCompleteVisit()
  const rescheduleVisit = useRescheduleVisit()

  if (!idNum) {
    return (
      <PageLayout title="Visita no encontrada">
        <div className="text-center py-12">
          <p className="text-gray-500">ID de visita inválido</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate('/operaciones/calendario')}>
            Volver al calendario
          </Button>
        </div>
      </PageLayout>
    )
  }

  if (isLoading) {
    return (
      <PageLayout title="Cargando visita...">
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Cargando información de la visita...</p>
        </div>
      </PageLayout>
    )
  }

  if (error || !visit) {
    return (
      <PageLayout title="Visita no encontrada">
        <div className="text-center py-12">
          <p className="text-red-500">{parseApiError(error)}</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate('/operaciones/calendario')}>
            Volver al calendario
          </Button>
        </div>
      </PageLayout>
    )
  }

  const handleCompleteVisit = () => {
    completeVisit.mutate({ id: idNum, notas: '' }, {
      onSuccess: () => {
        navigate('/operaciones/calendario')
      },
    })
  }

  const handleRescheduleVisit = () => {
    if (!rescheduleData.fecha_programada || !rescheduleData.hora_programada) return
    
    rescheduleVisit.mutate(
      { id: idNum, fecha_programada: rescheduleData.fecha_programada, hora_programada: rescheduleData.hora_programada },
      {
        onSuccess: () => {
          setShowRescheduleModal(false)
        },
      }
    )
  }

  return (
    <PageLayout title={`Operaciones › Visita ${visit.id}`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/operaciones/calendario')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
            <Button variant="outline" size="sm">
              <ClipboardList className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl">
                  Visita a {visit.cliente_nombre}
                </CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  {formatDate(visit.fecha_programada)} · {visit.hora_programada}
                  {visit.duracion_estimada && ` - Duración est.: ${visit.duracion_estimada}`}
                </p>
              </div>
              <Badge variant={estadoVariant[visit.estado]}>
                {estadoLabels[visit.estado]}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase text-gray-500">Información General</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <UserIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Cliente</p>
                  <p className="text-sm font-medium text-gray-900">{visit.cliente_nombre}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Tipo de visita</p>
                  <p className="text-sm font-medium text-gray-900">
                    {tipoVisitaLabels[visit.tipo_visita]}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <UserIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Socio asignado</p>
                  <p className="text-sm font-medium text-gray-900">{visit.socio_asignado}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Estado</p>
                  <Badge variant={estadoVariant[visit.estado]}>
                    {estadoLabels[visit.estado]}
                  </Badge>
                </div>
              </div>
              {visit.direccion_cliente && (
                <div className="flex items-start gap-3 sm:col-span-2">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Dirección</p>
                    <p className="text-sm font-medium text-gray-900">{visit.direccion_cliente}</p>
                  </div>
                </div>
              )}
              {visit.notas && (
                <div className="sm:col-span-2 bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Notas</p>
                  <p className="text-sm text-gray-700">{visit.notas}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase text-gray-500">
              Impresoras a visitar ({visit.impresoras.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {visit.impresoras.map((imp) => (
                <div key={imp.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {imp.marca} {imp.modelo}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        SERIE: {imp.numero_serie}
                      </p>
                    </div>
                    <Badge variant="neutral">
                      {imp.impresora_id}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Última lectura:</span>{' '}
                      <span className="font-medium">{formatDate(imp.fecha_lectura_anterior)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Contador anterior:</span>{' '}
                      <span className="font-medium">{imp.lectura_anterior.toLocaleString()} hojas</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Contrato:</span>{' '}
                      <span className="font-medium">{imp.contrato_id}</span>
                    </div>
                  </div>
                  {imp.lectura_actual !== undefined && (
                    <div className="mt-2 pt-2 border-t border-gray-100 text-sm">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <span className="text-gray-500">Lectura actual:</span>{' '}
                          <span className="font-medium text-green-600">
                            {imp.lectura_actual.toLocaleString()} hojas
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Páginas consumidas:</span>{' '}
                          <span className="font-medium">
                            {imp.paginas_consumidas?.toLocaleString()} hojas
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase text-gray-500">Acciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {visit.estado === 'PENDIENTE' && (
                <>
                  <Button onClick={() => navigate(`/operaciones/lecturas/${visit.id}`)}>
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Capturar lecturas
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleCompleteVisit}
                    disabled={completeVisit.isPending}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {completeVisit.isPending ? 'Completando...' : 'Marcar completada'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowRescheduleModal(true)}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reprogramar
                  </Button>
                </>
              )}
              {visit.estado !== 'CANCELADA' && visit.estado !== 'COMPLETADA' && (
                <Button variant="danger">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Cancelar visita
                </Button>
              )}
              {visit.estado === 'COMPLETADA' && (
                <div className="text-sm text-gray-500 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Esta visita ya fue completada
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Modal
        isOpen={showRescheduleModal}
        onClose={() => setShowRescheduleModal(false)}
        title="Reprogramar Visita"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva fecha *</label>
            <input
              type="date"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={rescheduleData.fecha_programada}
              onChange={(e) => setRescheduleData({ ...rescheduleData, fecha_programada: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva hora *</label>
            <input
              type="time"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={rescheduleData.hora_programada}
              onChange={(e) => setRescheduleData({ ...rescheduleData, hora_programada: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowRescheduleModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleRescheduleVisit}
              disabled={!rescheduleData.fecha_programada || !rescheduleData.hora_programada || rescheduleVisit.isPending}
            >
              {rescheduleVisit.isPending ? 'Reprogramando...' : 'Reprogramar'}
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}