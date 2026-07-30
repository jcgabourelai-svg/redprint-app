import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Edit,
  Printer,
  DollarSign,
  Calendar,
  Eye,
  Activity,
  Plus,
  FileText,
} from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Tabs from '@/components/ui/Tabs'
import { useContract, useUpdateContract, useAssignPrinter, useReleasePrinter } from '@/hooks/useContracts'
import { useVisits } from '@/hooks/useVisits'
import type { Contract, ContractStatus, VisitFrequency } from '@/types/contract'
import type { VisitStatus } from '@/types/operations'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { parseApiError } from '@/lib/api-errors'

const frecuenciaOptions = [
  { value: 'MENSUAL', label: 'Mensual' },
  { value: 'QUINCENAL', label: 'Quincenal' },
  { value: 'SEMANAL', label: 'Semanal' },
  { value: 'CUSTOM', label: 'Personalizado' },
]

const estadoLabels: Record<ContractStatus, string> = {
  ACTIVO: 'Activo',
  SUSPENDIDO: 'Suspendido',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
}

const visitaEstadoLabels: Record<VisitStatus, string> = {
  PENDIENTE: 'Pendiente',
  COMPLETADA: 'Completada',
  REPROGRAMADA: 'Reprogramada',
  CANCELADA: 'Cancelada',
  OMITIDA: 'Omitida',
}

const visitaEstadoVariant: Record<VisitStatus, 'primary' | 'success' | 'warning' | 'neutral'> = {
  PENDIENTE: 'primary',
  COMPLETADA: 'success',
  REPROGRAMADA: 'warning',
  CANCELADA: 'neutral',
  OMITIDA: 'neutral',
}

function getEsquemaLabel(contract: Contract): string {
  if (contract.tarifa_base === 0 && contract.paginas_incluidas === 0) return 'Puro consumo'
  if (contract.costo_por_pagina_excedente === 0) return 'Renta fija'
  return 'Tarifa base + páginas excedentes'
}

function getEsquemaFormula(contract: Contract): string {
  return `monto = ${formatCurrency(contract.tarifa_base)} + max(0, páginas - ${contract.paginas_incluidas}) × ${formatCurrency(contract.costo_por_pagina_excedente)}`
}

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const idNum = parseInt(id || '0')
  
  const { data: contract, isLoading, error } = useContract(idNum)
  const { data: visitsData, isLoading: isLoadingVisits } = useVisits(
    { contrato_id: idNum, per_page: 100 }
  )
  const assignPrinter = useAssignPrinter()
  const releasePrinter = useReleasePrinter()
  const updateContract = useUpdateContract(idNum)

  const [showEdit, setShowEdit] = useState(false)
  const [editError, setEditError] = useState('')
  const [form, setForm] = useState({
    tarifa_base: '',
    paginas_incluidas: '',
    costo_por_pagina_excedente: '',
    dias_gracia: '',
    dias_adelanto: '',
    frecuencia_visitas: 'MENSUAL' as VisitFrequency,
    dia_visita: '',
    fecha_fin: '',
  })

  const openEdit = () => {
    if (!contract) return
    setForm({
      tarifa_base: String(contract.tarifa_base ?? 0),
      paginas_incluidas: String(contract.paginas_incluidas ?? 0),
      costo_por_pagina_excedente: String(contract.costo_por_pagina_excedente ?? 0),
      dias_gracia: String(contract.dias_gracia ?? 0),
      dias_adelanto: String(contract.dias_adelanto ?? 1),
      frecuencia_visitas: contract.frecuencia_visitas ?? 'MENSUAL',
      dia_visita: contract.dia_visita ? String(contract.dia_visita) : '',
      fecha_fin: contract.fecha_fin ?? '',
    })
    setEditError('')
    setShowEdit(true)
  }

  const handleSave = () => {
    setEditError('')
    const payload = {
      tarifa_base: parseFloat(form.tarifa_base) || 0,
      paginas_incluidas: parseInt(form.paginas_incluidas) || 0,
      costo_pag_excedente: parseFloat(form.costo_por_pagina_excedente) || 0,
      dias_gracia: parseInt(form.dias_gracia) || 0,
      dias_adelanto: parseInt(form.dias_adelanto) || 1,
      frecuencia_visitas: form.frecuencia_visitas,
      dia_visita: form.dia_visita ? parseInt(form.dia_visita) : null,
      fecha_fin: form.fecha_fin || null,
    }
    updateContract.mutate(payload, {
      onSuccess: () => setShowEdit(false),
      onError: (err) => setEditError(parseApiError(err)),
    })
  }

  if (!idNum) {
    return (
      <PageLayout title="Contrato no encontrado">
        <div className="text-center py-12">
          <p className="text-muted-foreground">ID de contrato inválido</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate('/contratos')}>
            Volver a contratos
          </Button>
        </div>
      </PageLayout>
    )
  }

  if (isLoading) {
    return (
      <PageLayout title="Cargando contrato...">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Cargando información del contrato...</p>
        </div>
      </PageLayout>
    )
  }

  if (error || !contract) {
    return (
      <PageLayout title="Contrato no encontrado">
        <div className="text-center py-12">
          <p className="text-destructive">{parseApiError(error)}</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate('/contratos')}>
            Volver a contratos
          </Button>
        </div>
      </PageLayout>
    )
  }

  const totalEstimado = contract.impresoras.reduce((sum, p) => sum + p.estimado_del_periodo, 0)
  const totalRentAcum = contract.impresoras.reduce((sum, p) => sum + p.rentabilidad_acumulada, 0)

  const visitas = (visitsData?.data || [])
    .slice()
    .sort((a, b) => (a.fecha_programada < b.fecha_programada ? 1 : -1))

  return (
    <PageLayout title={`Contratos › ${contract.id}`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/contratos')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded bg-success/10">
                  <FileText className="h-6 w-6 text-success" />
                </div>
                <div>
                  <CardTitle className="text-xl">{contract.id}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {contract.cliente_nombre} - {contract.cliente_contacto}
                  </p>
                  <p className="text-xs text-muted-foreground">{getEsquemaLabel(contract)}</p>
                </div>
              </div>
              <Badge variant="contract_status" color={contract.estado}>
                {estadoLabels[contract.estado]}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase text-muted-foreground">Datos del Contrato</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="text-sm font-medium">{contract.cliente_nombre}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">RFC</p>
                  <p className="text-sm font-medium">{contract.cliente_rfc || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Contacto</p>
                  <p className="text-sm font-medium">{contract.cliente_contacto}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Teléfono</p>
                  <p className="text-sm font-medium">-</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase text-muted-foreground">Estado y Fechas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <Badge variant="contract_status" color={contract.estado}>
                    {estadoLabels[contract.estado]}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Desde</p>
                  <p className="text-sm font-medium">{formatDate(contract.fecha_inicio)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Duración</p>
                  <p className="text-sm font-medium">
                    {contract.fecha_fin ? formatDate(contract.fecha_fin) : 'Indefinido'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Próxima visita</p>
                  <p className="text-sm font-medium">
                    {contract.proxima_visita ? formatDate(contract.proxima_visita) : '-'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <CardTitle>Esquema de Cobro (Fórmula Unificada)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-3 mb-4">
              <code className="text-sm text-muted-foreground">{getEsquemaFormula(contract)}</code>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Tarifa base mensual</p>
                <p className="text-sm font-bold">{formatCurrency(contract.tarifa_base)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Páginas incluidas</p>
                <p className="text-sm font-bold">{contract.paginas_incluidas.toLocaleString('es-MX')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Costo por página excedente</p>
                <p className="text-sm font-bold">{formatCurrency(contract.costo_por_pagina_excedente)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Días de gracia</p>
                <p className="text-sm font-bold">{contract.dias_gracia} días</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="p-6 pb-0">
              <Tabs
                tabs={[
                  {
                    id: 'impresoras',
                    label: `Impresoras Asignadas (${contract.impresoras.length})`,
                    content: (
                      <div className="space-y-4 pb-4">
                        <div className="flex justify-end">
                          <Button size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Asignar
                          </Button>
                        </div>
                        {contract.impresoras.map((pa) => (
                          <div key={pa.id} className="border border-border rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <p className="font-medium text-foreground">
                                  {pa.impresora_id} - {pa.impresora_marca} {pa.impresora_modelo}
                                </p>
                                <p className="text-xs text-muted-foreground">SERIE: {pa.impresora_serie}</p>
                                <p className="text-xs text-muted-foreground">
                                  Asignada: {formatDate(pa.fecha_asignacion)} • Lectura inicial: {pa.lectura_inicial.toLocaleString('es-MX')}
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                              <div>
                                <p className="text-xs text-muted-foreground">Contador actual</p>
                                <p className="font-medium tabular-nums">{pa.contador_actual.toLocaleString('es-MX')} hojas</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Páginas del periodo</p>
                                <p className="font-medium tabular-nums">{pa.paginas_del_periodo.toLocaleString('es-MX')}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Estimado periodo</p>
                                <p className="font-medium text-success">{formatCurrency(pa.estimado_del_periodo)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Rentabilidad acumulada</p>
                                <p className={`font-medium ${pa.rentabilidad_acumulada >= 0 ? 'text-success' : 'text-destructive'}`}>
                                  {formatCurrency(pa.rentabilidad_acumulada)}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <Button variant="ghost" size="sm" onClick={() => navigate(`/inventario/impresoras/${pa.impresora_id}`)}>
                                <Eye className="mr-1 h-3 w-3" />
                                Ver detalle
                              </Button>
                              <Button variant="ghost" size="sm">
                                Liberar
                              </Button>
                            </div>
                          </div>
                        ))}
                        <div className="text-right pt-2 border-t">
                          <span className="text-sm text-muted-foreground">Total estimado este periodo: </span>
                          <span className="font-bold">{formatCurrency(totalEstimado)}</span>
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: 'visitas',
                    label: `Visitas Programadas (${visitas.length})`,
                    content: (
                      <div className="pb-4">
                        {isLoadingVisits ? (
                          <div className="text-center py-8">
                            <p className="text-muted-foreground">Cargando visitas...</p>
                          </div>
                        ) : visitas.length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-muted-foreground">No hay visitas programadas</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {visitas.map((visita) => (
                              <div
                                key={visita.id}
                                className="flex items-center justify-between border border-border rounded-lg p-3 hover:bg-muted/50 cursor-pointer"
                                onClick={() => navigate(`/operaciones/visitas/${visita.id}`)}
                              >
                                <div className="flex items-center gap-3">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <p className="text-sm font-medium">
                                      {formatDate(visita.fecha_programada)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {visita.socio_nombre || 'Sin socio asignado'}
                                    </p>
                                  </div>
                                </div>
                                <Badge variant={visitaEstadoVariant[visita.estado as VisitStatus]}>
                                  {visitaEstadoLabels[visita.estado as VisitStatus]}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ),
                  },
                  {
                    id: 'facturas',
                    label: 'Facturas Asociadas',
                    content: (
                      <div className="pb-4">
                        <div className="text-center py-8">
                          <p className="text-muted-foreground">No hay facturas asociadas</p>
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: 'rentabilidad',
                    label: 'Rentabilidad',
                    content: (
                      <div className="space-y-4 pb-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center p-4 bg-primary/10 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Ingresos</p>
                            <p className="text-xl font-bold text-primary">
                              {formatCurrency(contract.ingresos ?? 0)}
                            </p>
                          </div>
                          <div className="text-center p-4 bg-destructive/10 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Costos</p>
                            <p className="text-xl font-bold text-destructive">
                              {formatCurrency(contract.costos ?? 0)}
                            </p>
                          </div>
                          <div className="text-center p-4 bg-success/10 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Rentabilidad</p>
                            <p className={`text-xl font-bold ${(contract.rentabilidad ?? 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                              {formatCurrency(contract.rentabilidad ?? 0)}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-xs text-muted-foreground">Margen</p>
                            <p className="text-lg font-bold">{contract.margen ?? 0}%</p>
                          </div>
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-xs text-muted-foreground">ROI</p>
                            <p className="text-lg font-bold">
                              {(contract.costos ?? 0) > 0
                                ? Math.round(((contract.rentabilidad ?? 0) / (contract.costos ?? 1)) * 100)
                                : 0}%
                            </p>
                          </div>
                        </div>
                        {contract.impresoras.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-2">Desglose por impresora:</p>
                            {contract.impresoras.map((pa) => (
                              <div key={pa.id} className="flex justify-between py-1 text-sm">
                                <span className="text-muted-foreground">{pa.impresora_id} - {pa.impresora_marca} {pa.impresora_modelo}</span>
                                <span className={`font-medium ${pa.rentabilidad_acumulada >= 0 ? 'text-success' : 'text-destructive'}`}>
                                  {formatCurrency(pa.rentabilidad_acumulada)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title={`Editar Contrato #${contract.id}`}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Tarifa base mensual ($)</label>
              <Input
                type="number"
                step="0.01"
                value={form.tarifa_base}
                onChange={(e) => setForm({ ...form, tarifa_base: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Páginas incluidas</label>
              <Input
                type="number"
                value={form.paginas_incluidas}
                onChange={(e) => setForm({ ...form, paginas_incluidas: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Costo por página excedente ($)</label>
              <Input
                type="number"
                step="0.001"
                value={form.costo_por_pagina_excedente}
                onChange={(e) => setForm({ ...form, costo_por_pagina_excedente: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Días de gracia</label>
              <Input
                type="number"
                value={form.dias_gracia}
                onChange={(e) => setForm({ ...form, dias_gracia: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Días de adelanto (visitas)</label>
              <Input
                type="number"
                value={form.dias_adelanto}
                onChange={(e) => setForm({ ...form, dias_adelanto: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Frecuencia de visitas</label>
              <Select
                options={frecuenciaOptions}
                value={form.frecuencia_visitas}
                onChange={(v) => setForm({ ...form, frecuencia_visitas: v as VisitFrequency })}
              />
            </div>
            {form.frecuencia_visitas === 'MENSUAL' && (
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Día de visita del mes</label>
                <Select
                  options={[
                    { value: '', label: 'Derivar desde fecha de inicio' },
                    ...Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
                  ]}
                  value={form.dia_visita}
                  onChange={(v) => setForm({ ...form, dia_visita: v })}
                  placeholder="Día del mes (1-31)"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Fecha de fin (vacío = indefinido)
              </label>
              <Input
                type="date"
                value={form.fecha_fin}
                onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
              />
            </div>
          </div>

          {editError && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-2 rounded text-sm">
              {editError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowEdit(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={updateContract.isPending}>
              {updateContract.isPending ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}