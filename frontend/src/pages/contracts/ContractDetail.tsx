import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Edit,
  Pencil,
  Printer,
  Package,
  DollarSign,
  Calendar,
  Eye,
  Activity,
  Plus,
  FileText,
  Trash2,
  AlertTriangle,
  Receipt,
} from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import AliasBadge from '@/components/ui/AliasBadge'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Toast from '@/components/ui/Toast'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Tabs from '@/components/ui/Tabs'
import { useIsAdmin, useTienePermiso } from '@/contexts/AuthContext'
import {
  useContract,
  useUpdateContract,
  useAssignPrinter,
  useReleasePrinter,
  useUpdateAssignmentAlias,
  useUpdateContractPlan,
} from '@/hooks/useContracts'
import { useContractBilling, useCreateInvoiceDraftBatch } from '@/hooks/useInvoices'
import { usePrinterModels } from '@/hooks/usePrinterCatalog'
import { useVisits } from '@/hooks/useVisits'
import { usePrinters } from '@/hooks/usePrinters'
import { useWarehouses } from '@/hooks/useWarehouses'
import type { Contract, ContractStatus, PrinterAssignment, VisitFrequency } from '@/types/contract'
import { DIAS_GRACIA_LABEL, DIAS_GRACIA_HELP } from './contractLabels'
import { PrinterStatus, InvoiceStatusLabels } from '@/types/enums'
import type { VisitStatus } from '@/types/operations'
import { formatCurrency, formatDate, getInvoiceStatusColor } from '@/lib/formatters'
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

interface PlanEditRow {
  modelo_id: string
  cantidad: string
}

function getEsquemaLabel(contract: Contract): string {
  if (contract.tarifa_base === 0 && contract.paginas_incluidas === 0) return 'Puro consumo'
  if (contract.costo_por_pagina_excedente === 0) return 'Renta fija'
  return 'Tarifa base + páginas excedentes'
}

function getEsquemaFormula(contract: Contract): string {
  return `monto = ${formatCurrency(contract.tarifa_base)} + max(0, páginas - ${contract.paginas_incluidas}) × ${formatCurrency(contract.costo_por_pagina_excedente)}`
}

/** Rango de un ciclo de facturación: "20 ago – 19 sep 2026" (D17, por aniversario). */
function cicloLabel(inicio: string, fin: string): string {
  const i = new Date(`${inicio}T00:00:00`)
  const f = new Date(`${fin}T00:00:00`)
  const fmt = (d: Date) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  return i.getFullYear() === f.getFullYear()
    ? `${fmt(i)} – ${fmt(f)} ${f.getFullYear()}`
    : `${fmt(i)} ${i.getFullYear()} – ${fmt(f)} ${f.getFullYear()}`
}

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const idNum = parseInt(id || '0')
  const isAdmin = useIsAdmin()

  const { data: contract, isLoading, error } = useContract(idNum)
  const { data: visitsData, isLoading: isLoadingVisits } = useVisits(
    { contrato_id: idNum, per_page: 100 }
  )
  const assignPrinter = useAssignPrinter()
  const releasePrinter = useReleasePrinter()
  const updateContract = useUpdateContract(idNum)
  const updateAssignmentAlias = useUpdateAssignmentAlias()
  const updatePlan = useUpdateContractPlan(idNum)
  const { data: printerModels } = usePrinterModels(undefined, true)
  const { data: availablePrintersData, isLoading: isLoadingAvailablePrinters } = usePrinters({
    estado: PrinterStatus.EN_ALMACEN,
    per_page: 200,
  })
  const { data: warehousesData } = useWarehouses({ per_page: 100 })

  // Facturación del contrato (periodos fijos): requiere permiso de facturas.
  const puedeFacturar = useTienePermiso('finanzas.facturas')
  const billing = useContractBilling(idNum, puedeFacturar)
  const createDraftBatch = useCreateInvoiceDraftBatch()

  const [showGenerarFacturas, setShowGenerarFacturas] = useState(false)
  const [periodosSeleccionados, setPeriodosSeleccionados] = useState<string[]>([])
  const [batchError, setBatchError] = useState('')

  const [showEdit, setShowEdit] = useState(false)
  const [editError, setEditError] = useState('')
  const [aliasTarget, setAliasTarget] = useState<PrinterAssignment | null>(null)
  const [aliasValue, setAliasValue] = useState('')
  const [aliasError, setAliasError] = useState('')
  const [showAssign, setShowAssign] = useState(false)
  const [assignError, setAssignError] = useState('')
  const [assignForm, setAssignForm] = useState({ impresora_id: '', lectura_inicial: '', alias: '' })
  const [releaseTarget, setReleaseTarget] = useState<PrinterAssignment | null>(null)
  const [releaseWarehouseId, setReleaseWarehouseId] = useState('')
  const [releaseError, setReleaseError] = useState('')
  const [showPlanEdit, setShowPlanEdit] = useState(false)
  const [planRows, setPlanRows] = useState<PlanEditRow[]>([])
  const [planError, setPlanError] = useState('')
  const [toast, setToast] = useState<{ open: boolean; variant: 'success' | 'error'; message: string }>({
    open: false,
    variant: 'success',
    message: '',
  })
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

  const openAliasEdit = (pa: PrinterAssignment) => {
    setAliasTarget(pa)
    setAliasValue(pa.alias ?? '')
    setAliasError('')
  }

  const availablePrinters = availablePrintersData?.data || []
  const warehouses = (warehousesData?.data || []).filter((w) => w.activo)

  const openAssign = () => {
    setAssignForm({ impresora_id: '', lectura_inicial: '', alias: '' })
    setAssignError('')
    setShowAssign(true)
  }

  const handleAssignPrinterSelect = (value: string) => {
    const printer = availablePrinters.find((p) => String(p.id) === value)
    setAssignForm({
      ...assignForm,
      impresora_id: value,
      lectura_inicial: printer ? String(printer.contador_actual ?? 0) : assignForm.lectura_inicial,
    })
  }

  const handleAssignSave = () => {
    setAssignError('')
    if (!assignForm.impresora_id) {
      setAssignError('Selecciona una impresora disponible')
      return
    }
    assignPrinter.mutate(
      {
        id: idNum,
        impresora_id: Number(assignForm.impresora_id),
        lectura_inicial: parseInt(assignForm.lectura_inicial) || 0,
        alias: assignForm.alias.trim() || null,
      },
      {
        onSuccess: () => {
          setShowAssign(false)
          setToast({ open: true, variant: 'success', message: 'Impresora asignada al contrato' })
        },
        onError: (err) => setAssignError(parseApiError(err)),
      }
    )
  }

  const openRelease = (pa: PrinterAssignment) => {
    setReleaseTarget(pa)
    setReleaseWarehouseId('')
    setReleaseError('')
  }

  const handleReleaseSave = () => {
    if (!releaseTarget) return
    setReleaseError('')
    if (!releaseWarehouseId) {
      setReleaseError('Selecciona el almacén de destino')
      return
    }
    releasePrinter.mutate(
      {
        id: idNum,
        impresora_id: Number(releaseTarget.impresora_id),
        almacen_destino_id: Number(releaseWarehouseId),
      },
      {
        onSuccess: () => {
          setReleaseTarget(null)
          setToast({ open: true, variant: 'success', message: 'Impresora liberada' })
        },
        onError: (err) => setReleaseError(parseApiError(err)),
      }
    )
  }

  const handleAliasSave = () => {
    if (!aliasTarget) return
    setAliasError('')
    const alias = aliasValue.trim()
    updateAssignmentAlias.mutate(
      {
        contractId: idNum,
        assignmentId: Number(aliasTarget.id),
        alias: alias || null,
      },
      {
        onSuccess: () => {
          setAliasTarget(null)
          setToast({ open: true, variant: 'success', message: 'Alias actualizado' })
        },
        onError: (err) => setAliasError(parseApiError(err)),
      }
    )
  }

  const modelOptions = (printerModels || []).map((m) => ({
    value: String(m.id),
    label: m.marca ? `${m.marca} ${m.nombre}` : m.nombre,
  }))

  const openPlanEdit = () => {
    if (!contract) return
    setPlanRows(
      (contract.plan_impresoras ?? []).map((row) => ({
        modelo_id: String(row.modelo_id),
        cantidad: String(row.cantidad),
      }))
    )
    setPlanError('')
    setShowPlanEdit(true)
  }

  const addPlanRow = () => {
    const usedIds = new Set(planRows.map((r) => r.modelo_id).filter(Boolean))
    const firstFree = modelOptions.find((o) => !usedIds.has(o.value))
    setPlanRows([...planRows, { modelo_id: firstFree?.value ?? '', cantidad: '1' }])
  }

  const updatePlanRow = (index: number, patch: Partial<PlanEditRow>) => {
    setPlanRows(planRows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const removePlanRow = (index: number) => {
    setPlanRows(planRows.filter((_, i) => i !== index))
  }

  const handlePlanSave = () => {
    setPlanError('')
    const rows = planRows.filter((r) => r.modelo_id)
    const ids = rows.map((r) => r.modelo_id)
    if (new Set(ids).size !== ids.length) {
      setPlanError('No se puede repetir el mismo modelo de impresora en el plan')
      return
    }
    updatePlan.mutate(
      rows.map((r) => ({
        modelo_id: parseInt(r.modelo_id),
        cantidad: parseInt(r.cantidad) || 1,
      })),
      {
        onSuccess: () => {
          setShowPlanEdit(false)
          setToast({ open: true, variant: 'success', message: 'Plan de equipos actualizado' })
        },
        onError: (err) => setPlanError(parseApiError(err)),
      }
    )
  }

  const pendientes = billing.data?.pendientes ?? []
  const facturados = billing.data?.facturados ?? []

  const openGenerarFacturas = () => {
    // Default: periodos pasados pre-seleccionados; el mes en curso queda sin
    // marcar (lecturas incompletas).
    setPeriodosSeleccionados(pendientes.filter((p) => !p.actual).map((p) => p.periodo))
    setBatchError('')
    setShowGenerarFacturas(true)
  }

  const togglePeriodo = (periodo: string) => {
    setPeriodosSeleccionados((prev) =>
      prev.includes(periodo) ? prev.filter((p) => p !== periodo) : [...prev, periodo]
    )
  }

  const seleccion = pendientes.filter((p) => periodosSeleccionados.includes(p.periodo))
  const totalEstimadoSeleccion = seleccion.reduce((sum, p) => sum + p.monto_estimado, 0)

  const handleGenerarFacturas = () => {
    setBatchError('')
    if (!contract || seleccion.length === 0) return
    createDraftBatch.mutate(
      {
        cliente_id: parseInt(contract.cliente_id),
        contrato_id: idNum,
        periodos: seleccion.map((p) => p.periodo),
      },
      {
        onSuccess: (res) => {
          setShowGenerarFacturas(false)
          setToast({
            open: true,
            variant: 'success',
            message: `${res.data.length} borrador(es) de factura creados`,
          })
          // Los borradores vienen en orden cronológico: ir al más reciente.
          const ultimo = res.data[res.data.length - 1]
          if (ultimo) navigate(`/finanzas/facturas/${ultimo.id}`)
        },
        onError: (err) => setBatchError(parseApiError(err)),
      }
    )
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
                <p className="text-xs text-muted-foreground">{DIAS_GRACIA_LABEL}</p>
                <p className="text-sm font-bold">{contract.dias_gracia} días</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {(contract.plan_impresoras?.length || 0) > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  <CardTitle>Plan de Equipos</CardTitle>
                </div>
                {isAdmin && contract.estado === 'ACTIVO' && (
                  <Button variant="outline" size="sm" onClick={openPlanEdit}>
                    <Edit className="mr-2 h-4 w-4" />
                    Editar plan
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Intención comercial: qué modelos quedan contratados. El cobro nace al vincular la
                serie física (asignación), no desde este plan.
              </p>
              <div className="space-y-2">
                {contract.plan_impresoras!.map((row) => {
                  const instaladas = row.instaladas ?? 0
                  const pendientes = Math.max(0, row.cantidad - instaladas)
                  return (
                    <div
                      key={row.id}
                      className="flex items-center justify-between border border-border rounded-lg p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {row.marca ?? ''} {row.modelo_nombre ?? `Modelo #${row.modelo_id}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Instaladas {instaladas} de {row.cantidad}
                        </p>
                      </div>
                      {contract.estado === 'ACTIVO' && pendientes > 0 && (
                        <Badge variant="warning">Pendiente {pendientes}</Badge>
                      )}
                    </div>
                  )
                })}
              </div>
              {(contract.pendientes_instalacion ?? 0) > 0 && (
                <p className="text-xs text-warning mt-3">
                  {contract.pendientes_instalacion} equipo(s) del plan sin instalar. La instalación
                  se completa desde la app de campo durante una visita.
                </p>
              )}
            </CardContent>
          </Card>
        )}

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
                          <Button size="sm" onClick={openAssign}>
                            <Plus className="mr-2 h-4 w-4" />
                            Asignar
                          </Button>
                        </div>
                        {contract.impresoras.map((pa) => (
                          <div key={pa.id} className={`border rounded-lg p-4 ${pa.activa === false ? 'border-border/60 bg-muted/30' : 'border-border'}`}>
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-foreground">
                                    {pa.impresora_id} - {pa.impresora_marca} {pa.impresora_modelo}
                                  </p>
                                  {pa.alias && (
                                    <AliasBadge alias={pa.alias} color={pa.color} />
                                  )}
                                  {pa.activa === false && (
                                    <Badge variant="neutral">Liberada</Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">SERIE: {pa.impresora_serie}</p>
                                <p className="text-xs text-muted-foreground">
                                  Asignada: {formatDate(pa.fecha_asignacion)}
                                  {pa.activa === false && pa.fecha_liberacion && ` • Liberada: ${formatDate(pa.fecha_liberacion)}`}
                                  {' • '}Lectura inicial: {pa.lectura_inicial.toLocaleString('es-MX')}
                                </p>
                              </div>
                              {pa.activa !== false && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openAliasEdit(pa)}
                                  title="Editar alias"
                                >
                                  <Pencil className="mr-1 h-3 w-3" />
                                  Alias
                                </Button>
                              )}
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
                                <p className="text-xs text-muted-foreground">Rentabilidad estimada</p>
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
                              <Button variant="ghost" size="sm" onClick={() => openRelease(pa)}>
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
                    label: `Facturas Asociadas (${facturados.length})`,
                    content: (
                      <div className="space-y-3 pb-4">
                        {!puedeFacturar ? (
                          <div className="text-center py-8">
                            <p className="text-muted-foreground">
                              Sin permiso de facturas para consultar la facturación de este contrato.
                            </p>
                          </div>
                        ) : billing.isLoading ? (
                          <div className="text-center py-8">
                            <p className="text-muted-foreground">Cargando facturación...</p>
                          </div>
                        ) : billing.isError ? (
                          <div className="text-center py-8">
                            <p className="text-destructive">{parseApiError(billing.error)}</p>
                          </div>
                        ) : (
                          <>
                            {isAdmin && contract.estado === 'ACTIVO' && pendientes.length > 0 && (
                              <div className="flex justify-end">
                                <Button size="sm" onClick={openGenerarFacturas}>
                                  <Plus className="mr-2 h-4 w-4" />
                                  Generar factura
                                </Button>
                              </div>
                            )}
                            {facturados.length === 0 ? (
                              <div className="text-center py-8">
                                <Receipt className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                <p className="text-muted-foreground">
                                  {pendientes.length > 0
                                    ? 'Este contrato aún no tiene facturas y tiene periodos pendientes de facturar.'
                                    : 'Este contrato no tiene facturas asociadas.'}
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {facturados.map((f) => (
                                  <div
                                    key={f.factura_id}
                                    className="flex items-center justify-between border border-border rounded-lg p-3 hover:bg-muted/50 cursor-pointer"
                                    onClick={() => navigate(`/finanzas/facturas/${f.factura_id}`)}
                                  >
                                    <div className="flex items-center gap-3">
                                      <FileText className="h-4 w-4 text-muted-foreground" />
                                      <div>
                                        <p className="text-sm font-medium">
                                          {f.numero_factura ?? `Borrador #${f.factura_id}`}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          Periodo {cicloLabel(f.periodo_inicio, f.periodo_fin)}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm font-medium" title="Monto de este contrato en la factura">
                                        {formatCurrency(f.monto_contrato)}
                                      </span>
                                      <Badge className={getInvoiceStatusColor(f.estado)}>
                                        {(InvoiceStatusLabels as Record<string, string>)[f.estado] || f.estado}
                                      </Badge>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
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
                            <p className="text-xs text-muted-foreground mb-1">Ingresos (cobrado a la fecha)</p>
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
                        {contract.estimado_periodo_total != null && (
                          <p className="text-xs text-muted-foreground">
                            Estimado del periodo actual: {formatCurrency(contract.estimado_periodo_total)}{' '}
                            (intención comercial según contadores; no es ingreso cobrado).
                          </p>
                        )}
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
                            <p className="text-sm font-medium text-muted-foreground mb-2">
                              Rentabilidad estimada por impresora:
                            </p>
                            {contract.impresoras.map((pa) => (
                              <div key={pa.id} className="flex justify-between py-1 text-sm">
                                <span className="text-muted-foreground inline-flex items-center gap-1.5">
                                  {pa.impresora_id} - {pa.impresora_marca} {pa.impresora_modelo}
                                  {pa.alias && <AliasBadge alias={pa.alias} color={pa.color} />}
                                </span>
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
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {DIAS_GRACIA_LABEL}
              </label>
              <Input
                type="number"
                value={form.dias_gracia}
                onChange={(e) => setForm({ ...form, dias_gracia: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">{DIAS_GRACIA_HELP}</p>
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

      <Modal
        isOpen={aliasTarget !== null}
        onClose={() => setAliasTarget(null)}
        title="Editar alias de la asignación"
      >
        {aliasTarget && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {aliasTarget.impresora_marca} {aliasTarget.impresora_modelo} • SERIE: {aliasTarget.impresora_serie}
            </p>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Alias / ubicación
              </label>
              <Input
                type="text"
                placeholder="Ej. Recepción"
                value={aliasValue}
                onChange={(e) => setAliasValue(e.target.value)}
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Cómo la identifica el cliente en el sitio. Único entre asignaciones activas del contrato; vacío = sin alias.
              </p>
            </div>

            {aliasError && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-2 rounded text-sm">
                {aliasError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setAliasTarget(null)}>Cancelar</Button>
              <Button onClick={handleAliasSave} disabled={updateAssignmentAlias.isPending}>
                {updateAssignmentAlias.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={showAssign} onClose={() => setShowAssign(false)} title="Asignar impresora">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Impresora (en almacén)
            </label>
            {isLoadingAvailablePrinters ? (
              <p className="text-sm text-muted-foreground">Cargando impresoras disponibles...</p>
            ) : availablePrinters.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay impresoras disponibles en almacén. Una impresora debe estar en almacén
                para poder asignarse a un contrato.
              </p>
            ) : (
              <Select
                searchable
                options={availablePrinters.map((p) => ({
                  value: String(p.id),
                  label: `${p.marca} ${p.modelo} — ${p.num_serie}`,
                }))}
                value={assignForm.impresora_id}
                onChange={handleAssignPrinterSelect}
                placeholder="Seleccionar impresora..."
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Lectura inicial
            </label>
            <Input
              type="number"
              min={0}
              value={assignForm.lectura_inicial}
              onChange={(e) => setAssignForm({ ...assignForm, lectura_inicial: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Se toma el contador actual de la impresora como referencia; ajústala si la
              instalación inicia en otro valor.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Alias / ubicación (opcional)
            </label>
            <Input
              type="text"
              placeholder="Ej. Recepción"
              value={assignForm.alias}
              onChange={(e) => setAssignForm({ ...assignForm, alias: e.target.value })}
              maxLength={60}
            />
          </div>

          {assignError && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-2 rounded text-sm">
              {assignError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowAssign(false)}>Cancelar</Button>
            <Button
              onClick={handleAssignSave}
              disabled={assignPrinter.isPending || availablePrinters.length === 0}
            >
              {assignPrinter.isPending ? 'Asignando...' : 'Asignar'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showPlanEdit}
        onClose={() => setShowPlanEdit(false)}
        title="Editar plan de equipos"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Reemplaza el plan completo de modelos contratados. No toca las series ya asignadas.
          </p>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={addPlanRow} disabled={modelOptions.length === 0}>
              <Plus className="mr-1 h-3 w-3" />
              Agregar modelo
            </Button>
          </div>
          {planRows.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-4 text-sm text-muted-foreground">
              Sin filas: al guardar, el contrato quedará sin plan de modelos.
            </div>
          ) : (
            <div className="space-y-3">
              {planRows.map((row, index) => {
                const duplicado =
                  row.modelo_id &&
                  planRows.filter((r) => r.modelo_id === row.modelo_id).length > 1
                return (
                  <div key={index} className="border border-border rounded-lg p-3 space-y-2">
                    <div className="grid gap-2 sm:grid-cols-[1fr_100px_auto] items-center">
                      <Select
                        options={modelOptions}
                        value={row.modelo_id}
                        onChange={(v) => updatePlanRow(index, { modelo_id: v })}
                        placeholder="Seleccionar modelo..."
                        searchable
                      />
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={row.cantidad}
                        onChange={(e) => updatePlanRow(index, { cantidad: e.target.value })}
                      />
                      <Button variant="ghost" size="sm" onClick={() => removePlanRow(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    {duplicado && (
                      <p className="text-xs text-destructive">Modelo repetido en el plan</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {planError && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-2 rounded text-sm">
              {planError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowPlanEdit(false)}>Cancelar</Button>
            <Button onClick={handlePlanSave} disabled={updatePlan.isPending}>
              {updatePlan.isPending ? 'Guardando...' : 'Guardar Plan'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={releaseTarget !== null}
        onClose={() => setReleaseTarget(null)}
        title="Liberar impresora"
      >
        {releaseTarget && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {releaseTarget.impresora_marca} {releaseTarget.impresora_modelo} • SERIE:{' '}
              {releaseTarget.impresora_serie}
            </p>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Almacén de destino
              </label>
              {warehouses.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay almacenes activos configurados.
                </p>
              ) : (
                <Select
                  options={warehouses.map((w) => ({ value: String(w.id), label: w.nombre }))}
                  value={releaseWarehouseId}
                  onChange={setReleaseWarehouseId}
                  placeholder="Seleccionar almacén..."
                />
              )}
              <p className="text-xs text-muted-foreground mt-1">
                La impresora volverá al inventario del almacén seleccionado y quedará disponible
                para otro contrato.
              </p>
            </div>

            {releaseError && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-2 rounded text-sm">
                {releaseError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setReleaseTarget(null)}>Cancelar</Button>
              <Button
                variant="danger"
                onClick={handleReleaseSave}
                disabled={releasePrinter.isPending || warehouses.length === 0}
              >
                {releasePrinter.isPending ? 'Liberando...' : 'Liberar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showGenerarFacturas}
        onClose={() => setShowGenerarFacturas(false)}
        title="Generar facturas del contrato"
        size="xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Se crearán <strong>{seleccion.length}</strong> borrador(es), uno por ciclo
            seleccionado. Cada borrador reserva las lecturas de su ciclo y <strong>no es
            cuenta por cobrar</strong> hasta emitirse con el folio del PAC. No se fusionan
            ciclos: cada uno conserva sus páginas incluidas y su tarifa base.
          </p>

          <div className="space-y-2">
            {pendientes.map((p) => {
              const sinMonto = p.monto_estimado <= 0
              const marcado = periodosSeleccionados.includes(p.periodo)
              // D22: el estado "ciclo sin corte" se deriva del campo
              // estructurado (no del texto de la advertencia). El aviso del
              // backend, si esta, se muestra en el bloque propio; si su
              // redaccion cambia, degrada a aparecer en el listado normal
              // (nunca se pierde ni se contradice).
              const sinCorte = p.lectura_cierre_fecha === null && !sinMonto
              const avisoSinCorte = sinCorte
                ? p.advertencias.find((a) => a.includes('se cobra solo la renta base'))
                : undefined
              const otrasAdvertencias = sinCorte
                ? p.advertencias.filter((a) => a !== avisoSinCorte)
                : p.advertencias
              return (
                <label
                  key={p.periodo}
                  className={`flex items-start gap-3 border border-border rounded-lg p-3 ${
                    sinMonto ? 'opacity-60' : 'cursor-pointer hover:bg-muted/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={marcado}
                    disabled={sinMonto}
                    onChange={() => togglePeriodo(p.periodo)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{cicloLabel(p.periodo_inicio, p.periodo_fin)}</p>
                      {p.actual && <Badge variant="info">en curso</Badge>}
                      {(p.ciclos_acumulados ?? 1) > 1 && (
                        <Badge variant="warning">×{p.ciclos_acumulados} acumulado</Badge>
                      )}
                      {otrasAdvertencias.length > 0 && (
                        <span
                          className="text-warning inline-flex items-center"
                          title={otrasAdvertencias.join('\n')}
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.lecturas} lectura(s) · {p.paginas.toLocaleString('es-MX')} páginas
                      {(p.ciclos_acumulados ?? 1) > 1 &&
                        ` · paquete ${(p.paginas_incluidas_efectivas ?? 0).toLocaleString('es-MX')}`}{' '}
                      · Monto estimado {formatCurrency(p.monto_estimado)}
                    </p>
                    {sinCorte && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {avisoSinCorte ??
                          'Ciclo sin lectura de corte: se cobra solo la renta base; el consumo se acumula al siguiente ciclo con lectura de corte.'}
                      </p>
                    )}
                    {sinMonto && (
                      <p className="text-xs text-destructive mt-1">
                        Sin monto a facturar (sin lecturas y tarifa base 0). Si se incluyera,
                        el lote completo se cancelaría.
                      </p>
                    )}
                    {!sinMonto && otrasAdvertencias.length > 0 && (
                      <p className="text-xs text-warning mt-1">{otrasAdvertencias.join(' · ')}</p>
                    )}
                  </div>
                </label>
              )
            })}
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <p className="text-sm">
              <strong>{seleccion.length}</strong> borrador(es) · Total estimado{' '}
              <strong>{formatCurrency(totalEstimadoSeleccion)}</strong>
            </p>
          </div>

          {batchError && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-2 rounded text-sm">
              {batchError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowGenerarFacturas(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleGenerarFacturas}
              disabled={createDraftBatch.isPending || seleccion.length === 0}
            >
              {createDraftBatch.isPending ? 'Creando borradores...' : 'Crear borradores'}
            </Button>
          </div>
        </div>
      </Modal>

      <Toast
        isOpen={toast.open}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        variant={toast.variant}
        message={toast.message}
      />
    </PageLayout>
  )
}