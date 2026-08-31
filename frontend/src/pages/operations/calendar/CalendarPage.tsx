import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ClipboardList, Calendar as CalendarIcon, List, RefreshCw } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Calendar from '@/components/ui/Calendar'
import Table from '@/components/ui/Table'
import type { Column } from '@/components/ui/Table'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import type { CalendarEvent } from '@/components/ui/Calendar'
import type { Visit, VisitType, VisitStatus } from '@/types/operations'
import { useVisits, useCreateVisit, useSocios, useGenerateVisits, useVisitClientOptions } from '@/hooks/useVisits'
import type { VisitClientOption } from '@/hooks/useVisits'
import { formatDate } from '@/lib/formatters'
import { parseApiError } from '@/lib/api-errors'

const estadosFiltro = [
  { value: '', label: 'Todos' },
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'COMPLETADA', label: 'Completada' },
  { value: 'REPROGRAMADA', label: 'Reprogramada' },
  { value: 'CANCELADA', label: 'Cancelada' },
  { value: 'OMITIDA', label: 'Omitida' },
]

const tipoVisitaLabels: Record<VisitType, string> = {
  LECTURA: 'Lectura de contador',
  MANTENIMIENTO: 'Mantenimiento',
  INSTALACION: 'Instalación',
  RETIRO: 'Retiro',
  ENTREGA_INSUMOS: 'Entrega de insumos',
}

const tiposFiltro = [
  { value: '', label: 'Todos' },
  ...Object.entries(tipoVisitaLabels).map(([value, label]) => ({ value, label })),
]

// Espejo de la app móvil: estos tipos operan sobre el contrato del cliente.
const TIPO_REQUIERE_CONTRATO: Record<VisitType, boolean> = {
  LECTURA: true,
  INSTALACION: true,
  RETIRO: true,
  ENTREGA_INSUMOS: true,
  MANTENIMIENTO: false,
}

const estadoLabels: Record<VisitStatus, string> = {
  PENDIENTE: 'Pendiente',
  COMPLETADA: 'Completada',
  REPROGRAMADA: 'Reprogramada',
  CANCELADA: 'Cancelada',
  OMITIDA: 'Omitida',
}

const estadoVariant: Record<VisitStatus, 'primary' | 'success' | 'warning' | 'neutral'> = {
  PENDIENTE: 'primary',
  COMPLETADA: 'success',
  REPROGRAMADA: 'warning',
  CANCELADA: 'neutral',
  OMITIDA: 'neutral',
}

type VisitView = 'calendario' | 'lista'

const VIEW_KEY = 'redprint.visitas-view'

function getInitialView(): VisitView {
  const saved = localStorage.getItem(VIEW_KEY)
  if (saved === 'calendario' || saved === 'lista') return saved
  return window.matchMedia('(min-width: 1024px)').matches ? 'calendario' : 'lista'
}

export default function CalendarPage() {
  const navigate = useNavigate()
  const [socioFilter, setSocioFilter] = useState('')
  const [estadoFilter, setEstadoFilter] = useState('')
  const [tipoFilter, setTipoFilter] = useState('')
  const [view, setView] = useState<VisitView>(getInitialView)
  const [showNewVisitModal, setShowNewVisitModal] = useState(false)
  const [createError, setCreateError] = useState('')
  const [generateMsg, setGenerateMsg] = useState('')
  const [newVisit, setNewVisit] = useState({
    cliente_id: '',
    contrato_id: '',
    tipo_visita: 'LECTURA' as VisitType,
    fecha_programada: '',
    socio_id: '',
    notas: '',
  })

  const { data: visitsData, isLoading, error } = useVisits()
  const visits = visitsData?.data || []
  const createVisit = useCreateVisit()
  const generateVisits = useGenerateVisits()
  const { data: sociosData } = useSocios()
  const { data: visitClientsData } = useVisitClientOptions()

  const socios = sociosData || []
  const visitClients: VisitClientOption[] = visitClientsData || []

  const socioOptions = [
    { value: '', label: 'Todos' },
    ...socios.map((s) => ({ value: String(s.id), label: s.nombre })),
  ]
  const clientOptions = visitClients.map((c) => ({
    value: String(c.id),
    label: c.razon_social,
  }))

  const clienteSeleccionado = visitClients.find((c) => String(c.id) === newVisit.cliente_id) || null
  const contratosCliente = clienteSeleccionado?.contratos ?? []
  const contratoOptions = contratosCliente.map((ct) => ({
    value: String(ct.id),
    label: ct.codigo_negocio,
  }))
  const requiereContrato = TIPO_REQUIERE_CONTRATO[newVisit.tipo_visita]

  function handleClienteChange(clienteId: string) {
    const cliente = visitClients.find((c) => String(c.id) === clienteId)
    setNewVisit((prev) => ({
      ...prev,
      cliente_id: clienteId,
      contrato_id: cliente?.contratos[0] ? String(cliente.contratos[0].id) : '',
    }))
  }

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view)
  }, [view])

  const filteredVisits = useMemo(() => {
    return visits.filter((v) => {
      if (socioFilter && String(v.socio_id ?? '') !== socioFilter) return false
      if (estadoFilter && v.estado !== estadoFilter) return false
      if (tipoFilter && v.tipo_visita !== tipoFilter) return false
      return true
    })
  }, [visits, socioFilter, estadoFilter, tipoFilter])

  const hasLocalFilters = !!socioFilter || !!estadoFilter || !!tipoFilter
  const isVirginEmpty = visits.length === 0 && !hasLocalFilters

  const calendarEvents: CalendarEvent[] = filteredVisits.map((v) => ({
    id: v.id,
    date: new Date(v.fecha_programada + 'T12:00:00'),
    title: v.cliente_nombre || 'Visita',
    type: v.tipo_visita.toLowerCase(),
    status: v.estado.toLowerCase(),
    time: v.hora_programada,
  }))

  const columns: Column<Visit>[] = [
    {
      key: 'fecha_programada',
      label: 'Fecha',
      sortable: true,
      render: (value) => (value ? formatDate(value) : '-'),
    },
    {
      key: 'cliente_nombre',
      label: 'Cliente',
      render: (value) => value || '-',
    },
    {
      key: 'tipo_visita',
      label: 'Tipo',
      sortable: true,
      render: (value) => (
        <Badge variant="visit_type" color={String(value)}>
          {tipoVisitaLabels[value as VisitType] ?? String(value)}
        </Badge>
      ),
    },
    {
      key: 'socio_nombre',
      label: 'Socio',
      render: (_value, row) => row.socio_nombre || '-',
    },
    {
      key: 'impresoras',
      label: '# Impresoras',
      render: (_value, row) => row.impresoras?.length ?? 0,
    },
    {
      key: 'estado',
      label: 'Estado',
      render: (value) => (
        <Badge variant={estadoVariant[value as VisitStatus]}>
          {estadoLabels[value as VisitStatus]}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (_value, row) =>
        row.estado === 'PENDIENTE' ? (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/operaciones/lecturas/${row.id}`)
            }}
          >
            <ClipboardList className="mr-1 h-3 w-3" />
            Capturar lecturas
          </Button>
        ) : null,
    },
  ]

  if (isLoading) {
    return (
      <PageLayout title="Operaciones › Visitas">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Cargando visitas...</p>
        </div>
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout title="Operaciones › Visitas">
        <div className="flex items-center justify-center py-12">
          <p className="text-destructive">{parseApiError(error)}</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Operaciones › Visitas">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Visitas</h2>
            <p className="text-sm text-muted-foreground">
              Programación y seguimiento de visitas de campo
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              <Button
                variant={view === 'calendario' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setView('calendario')}
              >
                <CalendarIcon className="mr-1.5 h-4 w-4" />
                Calendario
              </Button>
              <Button
                variant={view === 'lista' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setView('lista')}
              >
                <List className="mr-1.5 h-4 w-4" />
                Lista
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={generateVisits.isPending}
                onClick={() => {
                  setGenerateMsg('')
                  generateVisits.mutate(undefined, {
                    onSuccess: (res) => {
                      setGenerateMsg(
                        res.creadas > 0
                          ? `Se generaron ${res.creadas} visita(s) nueva(s).`
                          : 'No se generaron visitas nuevas (todo al día).'
                      )
                    },
                    onError: (err) => {
                      setGenerateMsg(parseApiError(err))
                    },
                  })
                }}
              >
                <RefreshCw className={`mr-1.5 h-4 w-4 ${generateVisits.isPending ? 'animate-spin' : ''}`} />
                {generateVisits.isPending ? 'Generando...' : 'Generar visitas del próximo mes'}
              </Button>
              <Button onClick={() => setShowNewVisitModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva visita
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:w-48">
            <Select
              options={socioOptions}
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
          <div className="w-full sm:w-48">
            <Select
              options={tiposFiltro}
              value={tipoFilter}
              onChange={setTipoFilter}
              placeholder="Filtrar tipo"
            />
          </div>
        </div>

        {generateMsg && (
          <div className={`rounded-md p-3 text-sm ${generateVisits.isError ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {generateMsg}
          </div>
        )}

        {isVirginEmpty ? (
          <EmptyState
            icon={CalendarIcon}
            title="No hay visitas"
            description="Programa visitas desde el calendario o el detalle de un contrato."
            action={{ label: 'Nueva visita', onClick: () => setShowNewVisitModal(true) }}
          />
        ) : view === 'calendario' ? (
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
        ) : (
          <Table
            data={filteredVisits}
            columns={columns}
            searchable
            sortable
            paginatable
            emptyMessage="No se encontraron visitas con los filtros aplicados."
            onRowClick={(v) => navigate(`/operaciones/visitas/${v.id}`)}
          />
        )}
      </div>

      <Modal
        isOpen={showNewVisitModal}
        onClose={() => setShowNewVisitModal(false)}
        title="Nueva Visita"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Cliente *</label>
            <Select
              options={clientOptions}
              value={newVisit.cliente_id}
              onChange={handleClienteChange}
              placeholder="Seleccionar cliente"
              searchable
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Solo se listan clientes con contrato activo.
            </p>
          </div>
          {newVisit.cliente_id && contratosCliente.length === 1 && (
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Contrato</label>
              <p className="rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-foreground">
                {contratosCliente[0].codigo_negocio}
              </p>
            </div>
          )}
          {newVisit.cliente_id && contratosCliente.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Contrato *</label>
              <Select
                options={contratoOptions}
                value={newVisit.contrato_id}
                onChange={(v) => setNewVisit({ ...newVisit, contrato_id: v })}
                placeholder="Seleccionar contrato"
              />
            </div>
          )}
          {newVisit.cliente_id && contratosCliente.length === 0 && (
            <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 text-sm">
              El cliente no tiene contratos activos: solo se puede programar una visita de mantenimiento.
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Tipo de visita *</label>
            <Select
              options={Object.entries(tipoVisitaLabels).map(([value, label]) => ({ value, label }))}
              value={newVisit.tipo_visita}
              onChange={(v) => setNewVisit({ ...newVisit, tipo_visita: v as VisitType })}
              placeholder="Seleccionar tipo"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Fecha programada *</label>
            <Input
              type="date"
              value={newVisit.fecha_programada}
              onChange={(e) => setNewVisit({ ...newVisit, fecha_programada: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Socio asignado *</label>
            <Select
              options={socioOptions.slice(1)}
              value={newVisit.socio_id}
              onChange={(v) => setNewVisit({ ...newVisit, socio_id: v })}
              placeholder="Seleccionar socio"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Notas</label>
            <textarea
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
              value={newVisit.notas}
              onChange={(e) => setNewVisit({ ...newVisit, notas: e.target.value })}
              placeholder="Observaciones adicionales"
            />
          </div>
          {createError && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-2 rounded text-sm">
              {createError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowNewVisitModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setCreateError('')
                createVisit.mutate(
                  {
                    cliente_id: parseInt(newVisit.cliente_id),
                    contrato_id: newVisit.contrato_id ? parseInt(newVisit.contrato_id) : null,
                    tipo_visita: newVisit.tipo_visita,
                    fecha_programada: newVisit.fecha_programada,
                    socio_id: parseInt(newVisit.socio_id),
                    notas: newVisit.notas || null,
                  },
                  {
                    onSuccess: () => {
                      setShowNewVisitModal(false)
                      setNewVisit({
                        cliente_id: '',
                        contrato_id: '',
                        tipo_visita: 'LECTURA',
                        fecha_programada: '',
                        socio_id: '',
                        notas: '',
                      })
                    },
                    onError: (err) => setCreateError(parseApiError(err)),
                  }
                )
              }}
              disabled={
                createVisit.isPending ||
                !newVisit.cliente_id ||
                !newVisit.fecha_programada ||
                !newVisit.socio_id ||
                (requiereContrato && !newVisit.contrato_id)
              }
            >
              {createVisit.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}
