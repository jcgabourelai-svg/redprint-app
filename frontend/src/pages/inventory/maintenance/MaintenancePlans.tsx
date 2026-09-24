import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, Plus, Calendar, RefreshCw, Trash2 } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import {
  useMaintenancePlans,
  useCreateMaintenancePlan,
  useUpdateMaintenancePlan,
  useDeactivateMaintenancePlan,
  useCreateOrderFromPlan,
  useCreateOrdersBatch,
  type MaintenancePlan,
} from '@/hooks/useMaintenancePlans'
import { usePrinterModels } from '@/hooks/usePrinterCatalog'
import { usePrinters } from '@/hooks/usePrinters'
import { formatDate } from '@/lib/formatters'
import { parseApiError } from '@/lib/api-errors'

interface PlanFormData {
  destino: 'MODELO' | 'IMPRESORA'
  printer_model_id: string
  printer_id: string
  periodicidad_meses: string
  periodicidad_paginas: string
  ventana_aviso_dias: string
}

const emptyForm: PlanFormData = {
  destino: 'MODELO',
  printer_model_id: '',
  printer_id: '',
  periodicidad_meses: '6',
  periodicidad_paginas: '',
  ventana_aviso_dias: '15',
}

export default function MaintenancePlans() {
  const navigate = useNavigate()
  const { data, isLoading } = useMaintenancePlans()
  const createPlan = useCreateMaintenancePlan()
  const updatePlan = useUpdateMaintenancePlan()
  const deactivatePlan = useDeactivateMaintenancePlan()
  const createOrder = useCreateOrderFromPlan()
  const createBatch = useCreateOrdersBatch()

  const { data: modelsData } = usePrinterModels(undefined, true)
  const { data: printersData } = usePrinters({ per_page: 500 })

  const [showForm, setShowForm] = useState(false)
  const [editingPlan, setEditingPlan] = useState<MaintenancePlan | null>(null)
  const [form, setForm] = useState<PlanFormData>(emptyForm)
  const [formError, setFormError] = useState('')
  const [batchResult, setBatchResult] = useState<string | null>(null)
  const [batchError, setBatchError] = useState('')

  const plans = data?.data ?? []
  const upcoming = data?.upcoming ?? []

  const modelOptions = (modelsData ?? []).map((m: any) => ({
    value: String(m.id),
    label: `${m.marca ?? m.brand?.nombre ?? ''} ${m.nombre}`.trim(),
  }))

  const printerOptions = (printersData?.data ?? [])
    .filter((p: any) => p.estado !== 'DADA_DE_BAJA')
    .map((p: any) => ({
      value: String(p.id),
      label: `${p.marca} ${p.modelo} — ${p.num_serie ?? p.codigo_negocio ?? '#' + p.id}`,
    }))

  const openCreate = () => {
    setEditingPlan(null)
    setForm(emptyForm)
    setFormError('')
    setShowForm(true)
  }

  const openEdit = (plan: MaintenancePlan) => {
    setEditingPlan(plan)
    setForm({
      destino: plan.printer_id !== null ? 'IMPRESORA' : 'MODELO',
      printer_model_id: plan.printer_model_id ? String(plan.printer_model_id) : '',
      printer_id: plan.printer_id ? String(plan.printer_id) : '',
      periodicidad_meses: plan.periodicidad_meses ? String(plan.periodicidad_meses) : '',
      periodicidad_paginas: plan.periodicidad_paginas ? String(plan.periodicidad_paginas) : '',
      ventana_aviso_dias: String(plan.ventana_aviso_dias ?? 15),
    })
    setFormError('')
    setShowForm(true)
  }

  const handleFormSubmit = async () => {
    setFormError('')
    const meses = form.periodicidad_meses.trim()
    const paginas = form.periodicidad_paginas.trim()

    if (!meses && !paginas) {
      setFormError('Define al menos una periodicidad (meses o páginas).')
      return
    }

    const payload: Record<string, unknown> = {
      periodicidad_meses: meses ? parseInt(meses, 10) : null,
      periodicidad_paginas: paginas ? parseInt(paginas, 10) : null,
      ventana_aviso_dias: parseInt(form.ventana_aviso_dias || '15', 10),
    };

    if (form.destino === 'MODELO') {
      if (!form.printer_model_id) {
        setFormError('Selecciona el modelo de impresora.')
        return
      }
      payload.printer_model_id = parseInt(form.printer_model_id, 10)
    } else {
      if (!form.printer_id) {
        setFormError('Selecciona la impresora.')
        return
      }
      payload.printer_id = parseInt(form.printer_id, 10)
    }

    try {
      if (editingPlan) {
        await updatePlan.mutateAsync({ id: editingPlan.id, ...payload })
      } else {
        await createPlan.mutateAsync(payload)
      }
      setShowForm(false)
    } catch (err) {
      setFormError(parseApiError(err))
    }
  }

  const handleCreateOrder = async (item: (typeof upcoming)[number]) => {
    try {
      await createOrder.mutateAsync({
        planId: item.plan_id,
        impresoraId: item.impresora_id,
        fecha: new Date().toISOString().slice(0, 10),
      })
    } catch (err) {
      setBatchError(parseApiError(err))
    }
  }

  const handleCreateAll = async () => {
    setBatchError('')
    setBatchResult(null)
    const items = upcoming
      .filter((item) => !item.tiene_orden_abierta)
      .map((item) => ({
        impresora_id: item.impresora_id,
        plan_id: item.plan_id,
        fecha: new Date().toISOString().slice(0, 10),
      }))

    if (items.length === 0) {
      setBatchResult('No hay sugerencias pendientes sin orden abierta.')
      return
    }

    try {
      const result = await createBatch.mutateAsync(items)
      setBatchResult(
        `Órdenes creadas: ${result.creadas.length}` +
          (result.omitidas.length > 0 ? ` · Omitidas: ${result.omitidas.length}` : '')
      )
    } catch (err) {
      setBatchError(parseApiError(err))
    }
  }

  return (
    <PageLayout title="Inventario › Mantenimiento › Planes preventivos">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Planes preventivos</h2>
            <p className="text-sm text-muted-foreground">
              Cadencia por meses y/o páginas (el que ocurra primero). Las órdenes nacen de la bandeja,
              nunca automáticamente. La bandeja considera solo impresoras rentadas (en piso).
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/inventario/mantenimiento')}>
              Órdenes
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo plan
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-warning" />
                <CardTitle>Vencidos y próximos</CardTitle>
                <span className="text-xs text-muted-foreground">solo impresoras rentadas</span>
              </div>
              {upcoming.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleCreateAll} loading={createBatch.isPending}>
                  <Calendar className="mr-2 h-4 w-4" />
                  Crear todas ({upcoming.filter((i) => !i.tiene_orden_abierta).length})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : upcoming.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  No hay preventivos vencidos ni próximos entre las impresoras rentadas
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Estado</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Impresora</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Plan</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Vence por</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming.map((item) => (
                      <tr key={`${item.plan_id}-${item.impresora_id}`} className="border-b border-border">
                        <td className="px-4 py-2">
                          <Badge variant={item.estado === 'VENCIDO' ? 'error' : 'warning'}>
                            {item.estado === 'VENCIDO' ? 'Vencido' : 'Próximo'}
                          </Badge>
                        </td>
                        <td className="px-4 py-2">
                          <p className="font-medium">
                            {item.impresora.marca} {item.impresora.modelo}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.impresora.codigo ?? '-'} · #{item.impresora.id}
                          </p>
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {item.origen_plan === 'IMPRESORA' ? 'Por impresora' : 'Por modelo'}
                          {item.periodicidad_meses ? ` · cada ${item.periodicidad_meses} meses` : ''}
                          {item.periodicidad_paginas ? ` · cada ${item.periodicidad_paginas.toLocaleString('es-MX')} pág.` : ''}
                          <br />
                          Último: {item.ultimo_servicio_fecha ? formatDate(item.ultimo_servicio_fecha) : 'sin registro'}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {item.detalle.map((d) => (
                            <p key={d.eje}>
                              {d.eje === 'FECHA'
                                ? `${formatDate(String(d.proximo))} (${d.dias_restantes} días)`
                                : `${Number(d.proximo).toLocaleString('es-MX')} pág. (${d.paginas_restantes} restantes)`}
                            </p>
                          ))}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {item.tiene_orden_abierta ? (
                            <span className="text-xs text-muted-foreground">Orden abierta</span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCreateOrder(item)}
                              loading={createOrder.isPending}
                            >
                              Crear orden
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {batchResult && (
              <p className="border-t border-border px-4 py-2 text-sm text-success">{batchResult}</p>
            )}
            {batchError && (
              <p className="border-t border-border px-4 py-2 text-sm text-destructive">{batchError}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              <CardTitle>Planes configurados</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {plans.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="No hay planes preventivos"
                description="Configura la cadencia de servicio por modelo o por impresora."
                action={{ label: 'Nuevo plan', onClick: openCreate }}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Aplica a</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Cadencia</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Ventana aviso</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Último servicio</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Próximo</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((plan) => (
                      <tr key={plan.id} className={`border-b border-border ${plan.activo ? '' : 'opacity-50'}`}>
                        <td className="px-4 py-2 font-medium">
                          {plan.printer
                            ? `Impresora: ${plan.printer.marca} ${plan.printer.modelo}`
                            : `Modelo: ${plan.printer_model?.marca ?? ''} ${plan.printer_model?.nombre ?? ''}`}
                          {!plan.activo && <Badge className="ml-2" variant="neutral">Inactivo</Badge>}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {[
                            plan.periodicidad_meses ? `${plan.periodicidad_meses} meses` : null,
                            plan.periodicidad_paginas
                              ? `${plan.periodicidad_paginas.toLocaleString('es-MX')} pág.`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' + ')}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{plan.ventana_aviso_dias} días</td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {plan.ultimo_servicio_fecha ? formatDate(plan.ultimo_servicio_fecha) : 'sin registro'}
                          {plan.ultimo_servicio_contador !== null && (
                            <span className="block text-xs">
                              contador {plan.ultimo_servicio_contador.toLocaleString('es-MX')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {plan.proximo_servicio_fecha ? formatDate(plan.proximo_servicio_fecha) : '-'}
                          {plan.proximo_servicio_contador !== null && (
                            <span className="block text-xs">
                              contador {plan.proximo_servicio_contador.toLocaleString('es-MX')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(plan)}>
                              Editar
                            </Button>
                            {plan.activo && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deactivatePlan.mutate(plan.id)}
                                title="Desactivar plan"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingPlan ? 'Editar plan preventivo' : 'Nuevo plan preventivo'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Aplica a</label>
            <Select
              options={[
                { value: 'MODELO', label: 'Modelo de impresora (toda la flota del modelo)' },
                { value: 'IMPRESORA', label: 'Impresora específica (override)' },
              ]}
              value={form.destino}
              onChange={(v) => setForm({ ...form, destino: v as PlanFormData['destino'] })}
            />
          </div>

          {form.destino === 'MODELO' ? (
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Modelo</label>
              <Select
                options={modelOptions}
                value={form.printer_model_id}
                onChange={(v) => setForm({ ...form, printer_model_id: v })}
                placeholder="Seleccionar modelo..."
                searchable
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Impresora</label>
              <Select
                options={printerOptions}
                value={form.printer_id}
                onChange={(v) => setForm({ ...form, printer_id: v })}
                placeholder="Seleccionar impresora..."
                searchable
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Periodicidad (meses)
              </label>
              <Input
                type="number"
                min={1}
                value={form.periodicidad_meses}
                onChange={(e) => setForm({ ...form, periodicidad_meses: e.target.value })}
                placeholder="Ej. 6"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Periodicidad (páginas)
              </label>
              <Input
                type="number"
                min={1}
                value={form.periodicidad_paginas}
                onChange={(e) => setForm({ ...form, periodicidad_paginas: e.target.value })}
                placeholder="Ej. 50000"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Define una o ambas: el servicio vence con <strong>el que ocurra primero</strong>.
          </p>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Ventana de aviso (días)
            </label>
            <Input
              type="number"
              min={1}
              value={form.ventana_aviso_dias}
              onChange={(e) => setForm({ ...form, ventana_aviso_dias: e.target.value })}
            />
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleFormSubmit}
              loading={createPlan.isPending || updatePlan.isPending}
            >
              {editingPlan ? 'Guardar cambios' : 'Crear plan'}
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}
