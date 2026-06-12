import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Filter, Eye, ClipboardList, Clock, User as UserIcon, Printer } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Calendar from '@/components/ui/Calendar'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import type { CalendarEvent } from '@/components/ui/Calendar'
import type { Visit, VisitType, VisitStatus } from '@/types/operations'
import { useVisits } from '@/hooks/useVisits'
import { formatDate } from '@/lib/formatters'
import { parseApiError } from '@/lib/api-errors'

const socios = [
  { value: '', label: 'Todos' },
  { value: 'Maria Lopez', label: 'María López' },
  { value: 'Carlos Gomez', label: 'Carlos Gómez' },
  { value: 'Juan Perez', label: 'Juan Pérez' },
]

const estadosFiltro = [
  { value: '', label: 'Todos' },
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'COMPLETADA', label: 'Completada' },
  { value: 'REPROGRAMADA', label: 'Reprogramada' },
  { value: 'CANCELADA', label: 'Cancelada' },
]

const tipoVisitaLabels: Record<VisitType, string> = {
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

export default function CalendarPage() {
  const navigate = useNavigate()
  const [socioFilter, setSocioFilter] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')
  const [showNewVisitModal, setShowNewVisitModal] = useState(false)
  const [newVisit, setNewVisit] = useState({
    cliente_id: '',
    tipo_visita: 'LECTURA' as VisitType,
    fecha_programada: '',
    hora_programada: '',
    socio_asignado: '',
    notas: '',
  })

  const { data: visitsData, isLoading, error } = useVisits()
  const visits = visitsData?.data || []

  const filteredVisits = useMemo(() => {
    return visits.filter((v) => {
      if (socioFilter && v.socio_asignado !== socioFilter) return false
      if (estadoFilter && v.estado !== estadoFilter) return false
      return true
    })
  }, [visits, socioFilter, estadoFilter])

  const calendarEvents: CalendarEvent[] = filteredVisits.map((v) => ({
    id: v.id,
    date: new Date(v.fecha_programada + 'T12:00:00'),
    title: `${v.cliente_nombre} - ${v.hora_programada}`,
    type: v.tipo_visita.toLowerCase(),
    status: v.estado.toLowerCase(),
    time: v.hora_programada,
  }))

  const visitasDelMes = filteredVisits

  if (isLoading) {
    return (
      <PageLayout title="Operaciones › Calendario de Visitas">
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Cargando visitas...</p>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Operaciones › Calendario de Visitas">
        <div className="flex items-center justify-center py-12">
          <p className="text-red-500">{parseApiError(error)}</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Operaciones › Calendario de Visitas">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Calendario de Visitas</h2>
            <p className="text-sm text-gray-500">
              Programación y seguimiento de visitas de campo
            </p>
          </div>
          <Button onClick={() => setShowNewVisitModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva visita
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:w-48">
            <Select
              options={socios}
              value={socioFilter}
              onChange={setSocioFilter}
              placeholder="Filtrar socio"
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              options={estadosFiltro}
              value={estadoFilter}
              onChange={setEstadoFilter}
              placeholder="Filtrar estado"
            />
          </div>
        </div>

        <div className="hidden lg:block">
          <Calendar
            events={calendarEvents}
            onEventClick={(event) => navigate(`/operaciones/visitas/${event.id}`)}
            onDateClick={(date) => {
              const dateStr = date.toISOString().split('T')[0]
              const dayVisit = filteredVisits.find((v) => v.fecha_programada === dateStr)
              if (dayVisit) {
                navigate(`/operaciones/visitas/${dayVisit.id}`)
              }
            }}
          />
        </div>

        <div className="lg:hidden space-y-4">
          {visitasDelMes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No hay visitas programadas con los filtros seleccionados
            </div>
          ) : (
            visitasDelMes.map((visit) => (
              <div key={visit.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-600">
                      {formatDate(visit.fecha_programada)} - {visit.hora_programada}
                    </span>
                  </div>
                  <Badge variant={estadoVariant[visit.estado]}>
                    {estadoLabels[visit.estado]}
                  </Badge>
                </div>
                <p className="font-medium text-gray-900 mb-1">{visit.cliente_nombre}</p>
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                  <UserIcon className="h-4 w-4" />
                  <span>{visit.socio_asignado}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                  <Printer className="h-4 w-4" />
                  <span>{visit.impresoras?.length ?? 0} impresora(s)</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/operaciones/visitas/${visit.id}`)}>
                    <Eye className="mr-1 h-3 w-3" />
                    Ver
                  </Button>
                  {visit.estado === 'PENDIENTE' && (
                    <Button variant="outline" size="sm" onClick={() => navigate(`/operaciones/lecturas/${visit.id}`)}>
                      <ClipboardList className="mr-1 h-3 w-3" />
                      Capturar lecturas
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <Card className="hidden lg:block">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Visitas del mes ({visitasDelMes.length})</CardTitle>
              <Button variant="ghost" size="sm">
                Ver todas
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {visitasDelMes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay visitas programadas con los filtros seleccionados
                </div>
              ) : (
                visitasDelMes.map((visit) => (
                  <div
                    key={visit.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <CalendarIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium">
                          {formatDate(visit.fecha_programada)}
                        </span>
                      </div>
                      <Badge variant={estadoVariant[visit.estado]}>
                        {estadoLabels[visit.estado]}
                      </Badge>
                    </div>
                    <p className="font-medium text-gray-900 mb-1">{visit.cliente_nombre}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                      <span className="flex items-center gap-1">
                        <UserIcon className="h-3 w-3" />
                        {visit.socio_asignado}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {visit.hora_programada}
                      </span>
                      <span className="flex items-center gap-1">
                        <Printer className="h-3 w-3" />
                        {visit.impresoras?.length ?? 0} impresora(s)
                      </span>
                    </div>
                    {visit.impresoras?.length > 0 && (
                      <p className="text-xs text-gray-400 mb-2">
                        {visit.impresoras.map((imp) => imp.impresora_id).join(', ')}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/operaciones/visitas/${visit.id}`)}>
                        <Eye className="mr-1 h-3 w-3" />
                        Ver
                      </Button>
                      {visit.estado === 'PENDIENTE' && (
                        <Button variant="outline" size="sm" onClick={() => navigate(`/operaciones/lecturas/${visit.id}`)}>
                          <ClipboardList className="mr-1 h-3 w-3" />
                          Capturar lecturas
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Modal
        isOpen={showNewVisitModal}
        onClose={() => setShowNewVisitModal(false)}
        title="Nueva Visita"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
            <Input
              value={newVisit.cliente_id}
              onChange={(e) => setNewVisit({ ...newVisit, cliente_id: e.target.value })}
              placeholder="ID del cliente"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de visita *</label>
            <Select
              options={Object.entries(tipoVisitaLabels).map(([value, label]) => ({ value, label }))}
              value={newVisit.tipo_visita}
              onChange={(v) => setNewVisit({ ...newVisit, tipo_visita: v as VisitType })}
              placeholder="Seleccionar tipo"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha programada *</label>
              <Input
                type="date"
                value={newVisit.fecha_programada}
                onChange={(e) => setNewVisit({ ...newVisit, fecha_programada: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora programada *</label>
              <Input
                type="time"
                value={newVisit.hora_programada}
                onChange={(e) => setNewVisit({ ...newVisit, hora_programada: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Socio asignado *</label>
            <Select
              options={socios.slice(1)}
              value={newVisit.socio_asignado}
              onChange={(v) => setNewVisit({ ...newVisit, socio_asignado: v })}
              placeholder="Seleccionar socio"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={newVisit.notas}
              onChange={(e) => setNewVisit({ ...newVisit, notas: e.target.value })}
              placeholder="Observaciones adicionales"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowNewVisitModal(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setShowNewVisitModal(false)}>
              Guardar
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  )
}