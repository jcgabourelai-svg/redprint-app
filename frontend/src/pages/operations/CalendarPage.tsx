import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { useVisits, useCreateVisit } from '@/hooks/useVisits'
import { useClients } from '@/hooks/useClients'
import { useContracts } from '@/hooks/useContracts'
import { useUsers } from '@/hooks/useUsers'
import { formatDate } from '@/lib/utils'
import {
  VisitStatus,
  VISIT_STATUS_LABELS,
  VisitType,
  VISIT_TYPE_LABELS,
} from '@/types/enums'
import type { Visit } from '@/types/models'

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

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export default function CalendarPage() {
  const navigate = useNavigate()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate())
  const [socioFilter, setSocioFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const params: Record<string, string | number> = {
    mes: month,
    anio: year,
    per_page: 500,
  }
  if (socioFilter) params.socio_id = socioFilter

  const { data: visitsData, isLoading } = useVisits(params)
  const { data: usersData } = useUsers({ rol: 'OPERADOR', per_page: 100 })
  const createMutation = useCreateVisit()

  const visits = visitsData?.data ?? []
  const socios = usersData?.data ?? []

  const visitsByDay = useMemo(() => {
    const map: Record<number, Visit[]> = {}
    visits.forEach((v) => {
      const day = new Date(v.fecha_programada).getDate()
      if (!map[day]) map[day] = []
      map[day].push(v)
    })
    return map
  }, [visits])

  const selectedDayVisits = selectedDay ? (visitsByDay[selectedDay] ?? []) : []

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()

  const calendarCells: (number | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) calendarCells.push(null)
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d)

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1) }
    else setMonth((m) => m - 1)
    setSelectedDay(null)
  }

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear((y) => y + 1) }
    else setMonth((m) => m + 1)
    setSelectedDay(null)
  }

  const isToday = (day: number) => {
    return day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear()
  }

  return (
    <>
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold">Calendario de Visitas</h1>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Programar Visita
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[160px] text-center">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <Button variant="outline" size="sm" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="max-w-xs">
            <Select
              id="socio-filter"
              options={[
                { value: '', label: 'Todos los socios' },
                ...socios.map((u) => ({ value: String(u.id), label: u.nombre })),
              ]}
              value={socioFilter}
              onChange={(e) => setSocioFilter(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner text="Cargando visitas..." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="rounded-lg border">
                <div className="grid grid-cols-7">
                  {DAY_NAMES.map((name) => (
                    <div key={name} className="border-b p-2 text-center text-xs font-medium text-muted-foreground">
                      {name}
                    </div>
                  ))}
                  {calendarCells.map((day, idx) => (
                    <div
                      key={idx}
                      className={`min-h-[80px] border-b border-r p-1 cursor-pointer transition-colors sm:min-h-[100px] ${
                        day === null ? 'bg-muted/30' : 'hover:bg-muted/50'
                      } ${day === selectedDay ? 'bg-primary/10 ring-2 ring-primary/30 ring-inset' : ''}`}
                      onClick={() => day !== null && setSelectedDay(day)}
                    >
                      {day !== null && (
                        <>
                          <span
                            className={`text-xs font-medium inline-flex h-6 w-6 items-center justify-center rounded-full ${
                              isToday(day) ? 'bg-primary text-primary-foreground' : ''
                            }`}
                          >
                            {day}
                          </span>
                          {visitsByDay[day] && (
                            <div className="mt-1 space-y-0.5">
                              {visitsByDay[day].slice(0, 3).map((v) => (
                                <div
                                  key={v.id}
                                  className="truncate text-[10px] sm:text-xs rounded px-1 py-0.5 bg-muted"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    navigate(`/visitas/${v.id}`)
                                  }}
                                >
                                  {v.client?.razon_social ?? '—'}
                                </div>
                              ))}
                              {visitsByDay[day].length > 3 && (
                                <p className="text-[10px] text-muted-foreground px-1">
                                  +{visitsByDay[day].length - 3} mas
                                </p>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {selectedDay
                      ? `${selectedDay} de ${MONTH_NAMES[month - 1]}`
                      : 'Selecciona un dia'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedDay === null ? (
                    <p className="text-sm text-muted-foreground">Haz clic en un dia del calendario</p>
                  ) : selectedDayVisits.length === 0 ? (
                    <EmptyState title="Sin visitas" description="No hay visitas programadas para este dia" />
                  ) : (
                    <div className="space-y-3">
                      {selectedDayVisits.map((visit) => (
                        <div
                          key={visit.id}
                          className="rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => navigate(`/visitas/${visit.id}`)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">{visit.client?.razon_social ?? '—'}</span>
                            <Badge variant={visitTypeVariant[visit.tipo_visita]}>
                              {VISIT_TYPE_LABELS[visit.tipo_visita]}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Socio: {visit.socio?.nombre ?? '—'}</span>
                            <Badge variant={visitStatusVariant[visit.estado]}>
                              {VISIT_STATUS_LABELS[visit.estado]}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      <CreateVisitModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={(data) => {
          createMutation.mutate(data, {
            onSuccess: () => setShowCreate(false),
          })
        }}
        loading={createMutation.isPending}
      />
    </>
  )
}

interface CreateVisitModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: Record<string, unknown>) => void
  loading: boolean
}

function CreateVisitModal({ isOpen, onClose, onSubmit, loading }: CreateVisitModalProps) {
  const [form, setForm] = useState({
    cliente_id: '',
    contrato_id: '',
    tipo_visita: 'LECTURA',
    fecha_programada: '',
    socio_id: '',
    notas: '',
  })

  const { data: clientsData } = useClients({ per_page: 100 })
  const { data: contractsData } = useContracts(
    form.cliente_id ? { cliente_id: Number(form.cliente_id), per_page: 100 } : undefined
  )
  const { data: usersData } = useUsers({ rol: 'OPERADOR', per_page: 100 })

  const clients = clientsData?.data ?? []
  const contracts = contractsData?.data ?? []
  const socios = usersData?.data ?? []

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (field === 'cliente_id') {
      setForm((prev) => ({ ...prev, contrato_id: '' }))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data: Record<string, unknown> = {
      cliente_id: Number(form.cliente_id),
      tipo_visita: form.tipo_visita,
      fecha_programada: form.fecha_programada,
      socio_id: Number(form.socio_id),
      notas: form.notas || undefined,
    }
    if (form.contrato_id) data.contrato_id = Number(form.contrato_id)
    onSubmit(data)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Programar Visita">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          id="cliente_id"
          label="Cliente"
          options={clients.map((c) => ({ value: String(c.id), label: c.razon_social }))}
          placeholder="Selecciona un cliente"
          value={form.cliente_id}
          onChange={(e) => handleChange('cliente_id', e.target.value)}
          required
        />
        <Select
          id="contrato_id"
          label="Contrato (opcional)"
          options={contracts.map((c) => ({ value: String(c.id), label: c.codigo_negocio }))}
          placeholder="Selecciona un contrato"
          value={form.contrato_id}
          onChange={(e) => handleChange('contrato_id', e.target.value)}
        />
        <Select
          id="tipo_visita"
          label="Tipo de Visita"
          options={[
            { value: 'LECTURA', label: 'Lectura' },
            { value: 'MANTENIMIENTO', label: 'Mantenimiento' },
            { value: 'INSTALACION', label: 'Instalacion' },
            { value: 'RETIRO', label: 'Retiro' },
          ]}
          value={form.tipo_visita}
          onChange={(e) => handleChange('tipo_visita', e.target.value)}
          required
        />
        <Input
          id="fecha_programada"
          label="Fecha Programada"
          type="date"
          value={form.fecha_programada}
          onChange={(e) => handleChange('fecha_programada', e.target.value)}
          required
        />
        <Select
          id="socio_id"
          label="Socio Asignado"
          options={socios.map((u) => ({ value: String(u.id), label: u.nombre }))}
          placeholder="Selecciona un socio"
          value={form.socio_id}
          onChange={(e) => handleChange('socio_id', e.target.value)}
          required
        />
        <div className="space-y-1">
          <label htmlFor="notas" className="text-sm font-medium leading-none text-foreground">
            Notas
          </label>
          <textarea
            id="notas"
            value={form.notas}
            onChange={(e) => handleChange('notas', e.target.value)}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Programar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
