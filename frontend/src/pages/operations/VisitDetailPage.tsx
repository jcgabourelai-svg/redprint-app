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
  Package,
  Wrench,
  ArrowLeftRight,
} from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { useVisit, useCompleteVisit, useRescheduleVisit, useUpdateVisit, useDeleteVisit, useSocios } from '@/hooks/useVisits'
import type { VisitStatus, VisitReading } from '@/types/operations'
import { formatDate } from '@/lib/formatters'
import { problemTypeLabels, severityLabels, severityBadgeVariant } from '@/lib/maintenanceProblem'
import { parseApiError } from '@/lib/api-errors'
import { useState } from 'react'

const tipoVisitaLabels: Record<string, string> = {
  LECTURA: 'Lectura de contador',
  MANTENIMIENTO: 'Mantenimiento',
  INSTALACION: 'Instalación',
  RETIRO: 'Retiro',
  ENTREGA_INSUMOS: 'Entrega de insumos',
}

const estadoLabels: Record<VisitStatus, string> = {
  PENDIENTE: 'Pendiente',
  COMPLETADA: 'Completada',
  REPROGRAMADA: 'Reprogramada',
  CANCELADA: 'Cancelada',
  OMITIDA: 'Omitida',
}

const tipoManttoLabels: Record<string, string> = {
  PREVENTIVO: 'Preventivo',
  CORRECTIVO: 'Correctivo',
}

const eventoCambioLabels: Record<string, string> = {
  ASIGNACION_CONTRATO: 'Instalada',
  LIBERACION_CONTRATO: 'Retirada',
}

const estadoVariant: Record<VisitStatus, 'primary' | 'success' | 'warning' | 'neutral'> = {
  PENDIENTE: 'primary',
  COMPLETADA: 'success',
  REPROGRAMADA: 'warning',
  CANCELADA: 'neutral',
  OMITIDA: 'neutral',
}

export default function VisitDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const idNum = parseInt(id || '0')
  
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [rescheduleData, setRescheduleData] = useState({ fecha_programada: '' })
  const [editData, setEditData] = useState({ fecha_programada: '', socio_id: '', notas: '' })
  const [formError, setFormError] = useState('')
  const [motivoCierre, setMotivoCierre] = useState('')
  const [completeError, setCompleteError] = useState('')

  const { data: visit, isLoading, error } = useVisit(idNum)
  const completeVisit = useCompleteVisit()
  const rescheduleVisit = useRescheduleVisit()
  const updateVisit = useUpdateVisit()
  const deleteVisit = useDeleteVisit()
  const { data: sociosData } = useSocios()
  const socios = sociosData || []

  if (!idNum) {
    return (
      <PageLayout title="Visita no encontrada">
        <div className="text-center py-12">
          <p className="text-muted-foreground">ID de visita inválido</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate('/operaciones/visitas')}>
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
          <p className="text-muted-foreground">Cargando información de la visita...</p>
        </div>
      </PageLayout>
    )
  }

  if (error || !visit) {
    return (
      <PageLayout title="Visita no encontrada">
        <div className="text-center py-12">
          <p className="text-destructive">{parseApiError(error)}</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate('/operaciones/visitas')}>
            Volver al calendario
          </Button>
        </div>
      </PageLayout>
    )
  }

  const handleCompleteVisit = () => {
    setCompleteError('')
    completeVisit.mutate(
      { id: idNum, motivo_cierre: motivoCierre.trim() || undefined },
      {
        onSuccess: () => {
          setShowCompleteModal(false)
          navigate('/operaciones/visitas')
        },
        onError: (err) => setCompleteError(parseApiError(err)),
      }
    )
  }

  const openCompleteModal = () => {
    setMotivoCierre('')
    setCompleteError('')
    setShowCompleteModal(true)
  }

  const handleRescheduleVisit = () => {
    if (!rescheduleData.fecha_programada) return

    rescheduleVisit.mutate(
      { id: idNum, fecha_programada: rescheduleData.fecha_programada },
      {
        onSuccess: () => {
          setShowRescheduleModal(false)
        },
      }
    )
  }

  const openEdit = () => {
    setEditData({
      fecha_programada: visit.fecha_programada || '',
      socio_id: visit.socio_id ? String(visit.socio_id) : '',
      notas: visit.notas || '',
    })
    setFormError('')
    setShowEditModal(true)
  }

  const handleUpdateVisit = () => {
    setFormError('')
    updateVisit.mutate(
      {
        id: idNum,
        fecha_programada: editData.fecha_programada || undefined,
        socio_id: editData.socio_id ? parseInt(editData.socio_id) : undefined,
        notas: editData.notas ?? null,
      },
      {
        onSuccess: () => setShowEditModal(false),
        onError: (err) => setFormError(parseApiError(err)),
      }
    )
  }

  const handleDeleteVisit = () => {
    deleteVisit.mutate(idNum, {
      onSuccess: () => navigate('/operaciones/visitas'),
    })
  }

  const entregas = visit.entregas ?? []
  const mantenimientos = visit.mantenimientos ?? []
  const cambiosImpresoras = visit.cambios_impresoras ?? []
  const totalActividades =
    (visit.readings?.length ?? 0) + entregas.length + mantenimientos.length + cambiosImpresoras.length
  const requiereMotivoCierre = totalActividades === 0
  const impresorasList = visit.impresoras ?? []
  const lecturasList = visit.readings ?? []
  const todasLecturasCapturadas =
    visit.estado === 'PENDIENTE' &&
    impresorasList.length > 0 &&
    impresorasList.every((imp) =>
      lecturasList.some((r) => String(r.impresora_id) === String(imp.impresora_id))
    )


  return (
    <PageLayout title={`Operaciones › Visita ${visit.id}`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/operaciones/visitas')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={openEdit} disabled={visit.estado === 'COMPLETADA'}>
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
                <p className="text-sm text-muted-foreground mt-1">
                  {formatDate(visit.fecha_programada)}
                  {visit.hora_programada ? ` · ${visit.hora_programada}` : ''}
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
            <CardTitle className="text-sm uppercase text-muted-foreground">Información General</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <UserIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="text-sm font-medium text-foreground">{visit.cliente_nombre}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Tipo de visita</p>
                  <p className="text-sm font-medium text-foreground">
                    {tipoVisitaLabels[visit.tipo_visita]}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <UserIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Socio asignado</p>
                  <p className="text-sm font-medium text-foreground">{visit.socio_nombre || '-'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <Badge variant={estadoVariant[visit.estado]}>
                    {estadoLabels[visit.estado]}
                  </Badge>
                </div>
              </div>
              {visit.direccion_cliente && (
                <div className="flex items-start gap-3 sm:col-span-2">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Dirección</p>
                    <p className="text-sm font-medium text-foreground">{visit.direccion_cliente}</p>
                  </div>
                </div>
              )}
              {visit.notas && (
                <div className="sm:col-span-2 bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Notas</p>
                  <p className="text-sm text-muted-foreground">{visit.notas}</p>
                </div>
              )}
              {visit.motivo_cierre && (
                <div className="sm:col-span-2 bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Motivo de cierre</p>
                  <p className="text-sm text-muted-foreground">{visit.motivo_cierre}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {visit.impresoras && visit.impresoras.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase text-muted-foreground">
              Impresoras a visitar ({visit.impresoras.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {visit.impresoras.map((imp) => {
                const lectura = lecturasList.find(
                  (r) => String(r.impresora_id) === String(imp.impresora_id)
                ) as VisitReading | undefined
                const lecturaActual = lectura?.lectura_actual ?? imp.lectura_actual
                return (
                <div key={imp.id} className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-foreground">
                        {imp.marca} {imp.modelo}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        SERIE: {imp.numero_serie}
                      </p>
                    </div>
                    <Badge variant="neutral">
                      {imp.impresora_id}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Última lectura:</span>{' '}
                      <span className="font-medium">{formatDate(imp.fecha_lectura_anterior)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Contador anterior:</span>{' '}
                      <span className="font-medium">{imp.lectura_anterior.toLocaleString()} hojas</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Contrato:</span>{' '}
                      <span className="font-medium">{imp.contrato_id}</span>
                    </div>
                  </div>
                  {lecturaActual !== undefined && (
                    <div className="mt-2 pt-2 border-t border-border text-sm">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <span className="text-muted-foreground">Conteo de esta visita:</span>{' '}
                          <span className="font-medium text-success">
                            {Number(lecturaActual).toLocaleString('es-MX')} hojas
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Páginas impresas:</span>{' '}
                          <span className="font-medium">
                            {Number(lectura?.paginas_consumidas ?? imp.paginas_consumidas ?? 0).toLocaleString('es-MX')} hojas
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Capturada:</span>{' '}
                          <span className="font-medium">
                            {lectura?.fecha ? formatDate(lectura.fecha) : '-'}
                          </span>
                          {lectura?.socio_capturista ? ` · ${lectura.socio_capturista}` : ''}
                        </div>
                      </div>
                      {lectura?.es_anomalia && (
                        <p className="mt-1 text-xs text-warning">
                          Lectura marcada como anómala
                          {lectura.justificacion_anomalia ? `: ${lectura.justificacion_anomalia}` : ''}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
        )}

        {entregas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase text-muted-foreground">
              Insumos entregados ({entregas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {entregas.map((d) => (
                <div key={d.id} className="flex items-start justify-between border border-border rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">
                        {d.article?.nombre ?? `Artículo #${d.articulo_id}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {d.article?.marca ?? '-'} · {d.article?.modelo_sku ?? '-'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium text-foreground">×{d.cantidad}</p>
                    <p className="text-xs text-muted-foreground">
                      ${Number(d.subtotal ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        )}

        {mantenimientos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase text-muted-foreground">
              Órdenes de mantenimiento ({mantenimientos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mantenimientos.map((m) => (
                <div key={m.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Wrench className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground">
                          {m.printer ? `${m.printer.marca} ${m.printer.modelo}` : `Impresora #${m.impresora_id}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {tipoManttoLabels[m.tipo_mantto ?? ''] ?? m.tipo_mantto} · {m.fecha ?? '-'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {m.tipo_problema && (
                        <Badge variant="neutral">
                          {problemTypeLabels[m.tipo_problema] ?? m.tipo_problema}
                        </Badge>
                      )}
                      {m.severidad && (
                        <Badge
                          variant={severityBadgeVariant(m.severidad)}
                          className={m.severidad === 'CRITICA' ? 'ring-2 ring-red-300' : ''}
                        >
                          {severityLabels[m.severidad] ?? m.severidad}
                        </Badge>
                      )}
                      <Badge variant="neutral">{m.estado ?? '-'}</Badge>
                    </div>
                  </div>
                  {m.desc_problema && (
                    <p className="mt-2 text-sm text-muted-foreground">{m.desc_problema}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        )}

        {cambiosImpresoras.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase text-muted-foreground">
              Cambios de impresoras ({cambiosImpresoras.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {cambiosImpresoras.map((c, i) => (
                <div key={`${c.evento}-${i}`} className="flex items-start justify-between border border-border rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <ArrowLeftRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">
                        {c.impresora ? `${c.impresora.marca} ${c.impresora.modelo}` : 'Impresora'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        SERIE: {c.impresora?.num_serie ?? '-'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={c.evento === 'ASIGNACION_CONTRATO' ? 'success' : 'warning'}>
                      {eventoCambioLabels[c.evento] ?? c.evento}
                    </Badge>
                    {c.fecha && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(c.fecha).toLocaleString('es-MX')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase text-muted-foreground">Acciones</CardTitle>
          </CardHeader>
          <CardContent>
            {todasLecturasCapturadas && (
              <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
                ✅ Todas las lecturas del contrato están capturadas. Si la visita
                terminó, márcala como completada. Antes del cierre todavía
                puedes registrar entregas, fallas o cambios de impresoras.
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              {visit.estado === 'PENDIENTE' && (
                <>
                  <Button onClick={() => navigate(`/operaciones/lecturas/${visit.id}`)}>
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Capturar lecturas
                  </Button>
                  <Button
                    variant="outline"
                    onClick={openCompleteModal}
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
              {visit.estado !== 'CANCELADA' && visit.estado !== 'COMPLETADA' && visit.estado !== 'OMITIDA' && (
                <Button
                  variant="danger"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleteVisit.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {deleteVisit.isPending ? 'Cancelando...' : 'Cancelar visita'}
                </Button>
              )}
              {visit.estado === 'COMPLETADA' && (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
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
            <label className="block text-sm font-medium text-muted-foreground mb-1">Nueva fecha *</label>
            <input
              type="date"
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={rescheduleData.fecha_programada}
              onChange={(e) => setRescheduleData({ ...rescheduleData, fecha_programada: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowRescheduleModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRescheduleVisit}
              disabled={!rescheduleData.fecha_programada || rescheduleVisit.isPending}
            >
              {rescheduleVisit.isPending ? 'Reprogramando...' : 'Reprogramar'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Editar Visita"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Fecha programada</label>
            <input
              type="date"
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={editData.fecha_programada}
              onChange={(e) => setEditData({ ...editData, fecha_programada: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Socio asignado</label>
            <select
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={editData.socio_id}
              onChange={(e) => setEditData({ ...editData, socio_id: e.target.value })}
            >
              <option value="">Sin asignar</option>
              {socios.map((s) => (
                <option key={s.id} value={String(s.id)}>{s.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Notas</label>
            <textarea
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
              value={editData.notas}
              onChange={(e) => setEditData({ ...editData, notas: e.target.value })}
            />
          </div>
          {formError && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-2 rounded text-sm">
              {formError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateVisit} disabled={updateVisit.isPending}>
              {updateVisit.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        title="Completar visita"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground space-y-1">
            <p>Lecturas registradas: {visit.readings?.length ?? 0}</p>
            <p>Insumos entregados: {entregas.length}</p>
            <p>Órdenes de mantenimiento: {mantenimientos.length}</p>
            <p>Cambios de impresoras: {cambiosImpresoras.length}</p>
          </div>

          {requiereMotivoCierre ? (
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Motivo de cierre *
              </label>
              <textarea
                className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                rows={3}
                placeholder="La visita no tiene actividades registradas; describe el motivo del cierre..."
                value={motivoCierre}
                onChange={(e) => setMotivoCierre(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                El motivo es obligatorio cuando no hay actividades registradas.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Hay actividades registradas; no se requiere motivo de cierre.
            </p>
          )}

          {completeError && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-2 rounded text-sm">
              {completeError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowCompleteModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCompleteVisit}
              disabled={completeVisit.isPending || (requiereMotivoCierre && motivoCierre.trim().length < 5)}
            >
              {completeVisit.isPending ? 'Completando...' : 'Completar visita'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Cancelar visita"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            ¿Seguro que deseas cancelar/eliminar esta visita? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
              No, volver
            </Button>
            <Button variant="danger" onClick={handleDeleteVisit} disabled={deleteVisit.isPending}>
              {deleteVisit.isPending ? 'Cancelando...' : 'Sí, cancelar visita'}
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}