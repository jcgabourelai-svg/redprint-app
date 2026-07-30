import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, AlertTriangle } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/formatters'
import { useCreateInvoice, useInvoiceCalculation } from '@/hooks/useInvoices'
import { useClients } from '@/hooks/useClients'
import { parseApiError } from '@/lib/api-errors'

const steps = [
  { id: '1', label: 'Datos Generales' },
  { id: '2', label: 'Impresoras y Contratos' },
  { id: '3', label: 'Revisión' },
]

export default function RegisterInvoicePage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [form, setForm] = useState({
    numero_factura: '',
    cliente_id: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '',
    periodo_inicio: '',
    periodo_fin: '',
    monto_total: '',
    metodo_calculo: 'lecturas' as 'lecturas' | 'manual',
    notas: '',
  })
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const createInvoice = useCreateInvoice()
  const { data: clientsData, isLoading: clientsLoading } = useClients({ per_page: 100 })

  const isLecturasMode = form.metodo_calculo === 'lecturas'

  const calculo = useInvoiceCalculation(
    form.cliente_id,
    form.periodo_inicio,
    form.periodo_fin,
    isLecturasMode,
  )

  const clients = clientsData?.data || []
  const clientOptions = clients.map((c) => ({
    value: c.id,
    label: `${c.razon_social}${c.rfc ? ` (${c.rfc})` : ''}`,
  }))
  const selectedClientLabel = clients.find((c) => c.id === form.cliente_id)?.razon_social

  const calcMonto = calculo.data?.monto_total ?? 0
  const effectiveMonto = isLecturasMode ? calcMonto : Number(form.monto_total) || 0
  const periodoIncomplete = !form.cliente_id || !form.periodo_inicio || !form.periodo_fin

  const handleCreateInvoice = async () => {
    setError('')
    try {
      const payload: Record<string, unknown> = {
        numero_factura: form.numero_factura,
        cliente_id: parseInt(form.cliente_id),
        fecha_emision: form.fecha_emision,
        fecha_vencimiento: form.fecha_vencimiento,
        periodo_inicio: form.periodo_inicio || undefined,
        periodo_fin: form.periodo_fin || undefined,
        monto_total: effectiveMonto,
        notas: form.notas || undefined,
      }

      if (isLecturasMode && calculo.data?.detalles?.length) {
        payload.detalles = calculo.data.detalles
      }

      await createInvoice.mutateAsync(payload)
      navigate('/finanzas/cuentas-por-cobrar')
    } catch (err) {
      setError(parseApiError(err))
    }
  }

  const step1Valid =
    !!form.numero_factura &&
    !!form.cliente_id &&
    !!form.fecha_vencimiento &&
    (isLecturasMode ? !!calculo.data : !!form.monto_total)

  const advertencias = calculo.data?.advertencias ?? []

  return (
    <PageLayout title="Registrar Factura">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Registrar Factura</h2>
            <p className="text-sm text-muted-foreground">Registro manual de factura emitida en PAC externo</p>
          </div>
          <Button variant="ghost" onClick={() => navigate('/finanzas/cuentas-por-cobrar')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                currentStep === index + 1
                  ? 'bg-primary text-white'
                  : currentStep > index + 1
                  ? 'bg-success/10 text-success'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {currentStep > index + 1 ? <Check className="h-4 w-4" /> : <span className="w-5 h-5 rounded-full bg-current bg-opacity-20 flex items-center justify-center text-xs">{index + 1}</span>}
                {step.label}
              </div>
              {index < steps.length - 1 && (
                <div className={`w-8 h-0.5 mx-1 ${currentStep > index + 1 ? 'bg-success' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>

        <Card>
          <CardContent className="p-6">
            {currentStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Paso 1 de 3: Datos Generales de la Factura</h3>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Número de factura (del PAC externo) *</label>
                  <Input
                    value={form.numero_factura}
                    onChange={(e) => setForm({ ...form, numero_factura: e.target.value })}
                    placeholder="F-001"
                    error={error && !form.numero_factura ? 'Requerido' : undefined}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Cliente *</label>
                  {clientsLoading ? (
                    <p className="text-sm text-muted-foreground">Cargando clientes...</p>
                  ) : (
                    <Select
                      options={clientOptions}
                      value={form.cliente_id}
                      onChange={(v) => setForm({ ...form, cliente_id: v })}
                      placeholder="Seleccionar cliente"
                      searchable
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Fecha de emisión *</label>
                  <Input
                    type="date"
                    value={form.fecha_emision}
                    onChange={(e) => setForm({ ...form, fecha_emision: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Fecha de vencimiento *</label>
                  <Input
                    type="date"
                    value={form.fecha_vencimiento}
                    onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Periodo inicio *</label>
                    <Input
                      type="date"
                      value={form.periodo_inicio}
                      onChange={(e) => setForm({ ...form, periodo_inicio: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Periodo fin *</label>
                    <Input
                      type="date"
                      value={form.periodo_fin}
                      onChange={(e) => setForm({ ...form, periodo_fin: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Método de cálculo *</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="metodo" value="lecturas" checked={form.metodo_calculo === 'lecturas'} onChange={() => setForm({ ...form, metodo_calculo: 'lecturas', monto_total: '' })} className="text-primary" />
                      <span className="text-sm">Según lecturas registradas (recomendado)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="metodo" value="manual" checked={form.metodo_calculo === 'manual'} onChange={() => setForm({ ...form, metodo_calculo: 'manual' })} className="text-primary" />
                      <span className="text-sm">Monto manual</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Monto total *</label>
                  {isLecturasMode ? (
                    <>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={periodoIncomplete ? '' : (calculo.data ? String(calculo.data.monto_total) : '')}
                        readOnly
                        disabled
                        placeholder={periodoIncomplete ? 'Selecciona cliente y periodo para calcular' : 'Calculando...'}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Monto calculado automáticamente desde las lecturas del periodo (campo bloqueado).
                      </p>
                    </>
                  ) : (
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.monto_total}
                      onChange={(e) => setForm({ ...form, monto_total: e.target.value })}
                      placeholder="0.00"
                    />
                  )}
                </div>

                {isLecturasMode && !periodoIncomplete && (
                  <div className="space-y-1">
                    {calculo.isLoading && (
                      <p className="text-sm text-muted-foreground">Calculando monto desde lecturas...</p>
                    )}
                    {calculo.isError && (
                      <p className="text-sm text-destructive">No se pudo calcular el monto. Verifica los datos o usa modo manual.</p>
                    )}
                  </div>
                )}

                {advertencias.length > 0 && (
                  <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 space-y-1">
                    {advertencias.map((adv, i) => (
                      <p key={i} className="text-sm text-warning flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        {adv}
                      </p>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="secondary" onClick={() => navigate('/finanzas/cuentas-por-cobrar')}>Cancelar</Button>
                  <Button onClick={() => setCurrentStep(2)} disabled={!step1Valid}>
                    Siguiente <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Paso 2 de 3: Impresoras y Contratos</h3>

                {form.cliente_id && (
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm">Cliente seleccionado: <strong>{selectedClientLabel}</strong></p>
                  </div>
                )}

                {isLecturasMode && calculo.data ? (
                  calculo.data.contratos.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="py-2 pr-4">Contrato</th>
                            <th className="py-2 pr-4 text-right">Páginas</th>
                            <th className="py-2 pr-4 text-right">Tarifa base</th>
                            <th className="py-2 pr-4 text-right">Costo/pág. exced.</th>
                            <th className="py-2 pr-4 text-right">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calculo.data.contratos.map((c) => (
                            <tr key={c.contrato_id} className="border-b">
                              <td className="py-2 pr-4 font-medium">{c.codigo}</td>
                              <td className="py-2 pr-4 text-right">{c.total_paginas}</td>
                              <td className="py-2 pr-4 text-right">{formatCurrency(c.tarifa_base)}</td>
                              <td className="py-2 pr-4 text-right">{formatCurrency(c.costo_pag_excedente)}</td>
                              <td className="py-2 pr-4 text-right font-semibold">{formatCurrency(c.monto_contrato)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="font-semibold">
                            <td className="py-2 pr-4" colSpan={4}>Total</td>
                            <td className="py-2 pr-4 text-right">{formatCurrency(calculo.data.monto_total)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="bg-muted p-4 rounded-lg text-sm text-muted-foreground">
                      No hay contratos activos ni lecturas para calcular en este periodo.
                    </div>
                  )
                ) : (
                  <div className="bg-muted p-4 rounded-lg text-sm text-muted-foreground">
                    {isLecturasMode
                      ? 'Esperando datos del cálculo...'
                      : 'Modo manual: el monto se captura directamente en el paso anterior.'}
                  </div>
                )}

                {advertencias.length > 0 && (
                  <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 space-y-1">
                    {advertencias.map((adv, i) => (
                      <p key={i} className="text-sm text-warning flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        {adv}
                      </p>
                    ))}
                  </div>
                )}

                <div className="flex justify-between pt-4">
                  <Button variant="secondary" onClick={() => setCurrentStep(1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Anterior
                  </Button>
                  <Button onClick={() => setCurrentStep(3)}>
                    Siguiente <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Paso 3 de 3: Revisión y Confirmación</h3>

                <Card>
                  <CardHeader>
                    <CardTitle>Resumen de la Factura</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <p>Número de factura: <strong>{form.numero_factura}</strong></p>
                      <p>Cliente: <strong>{selectedClientLabel}</strong></p>
                      <p>Fecha de emisión: <strong>{form.fecha_emision}</strong></p>
                      <p>Fecha de vencimiento: <strong>{form.fecha_vencimiento}</strong></p>
                      <p>Periodo: <strong>{form.periodo_inicio} - {form.periodo_fin}</strong></p>
                      <p>Método de cálculo: <strong>{isLecturasMode ? 'Según lecturas' : 'Manual'}</strong></p>
                      <p>Monto total: <strong>{formatCurrency(effectiveMonto)}</strong></p>
                      {isLecturasMode && calculo.data && calculo.data.detalles.length > 0 && (
                        <p className="text-muted-foreground">
                          Se generarán <strong>{calculo.data.detalles.length}</strong> líneas de detalle vinculadas a las lecturas.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Notas (opcional)</label>
                  <textarea
                    className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    rows={3}
                    value={form.notas}
                    onChange={(e) => setForm({ ...form, notas: e.target.value })}
                    placeholder="Notas adicionales..."
                  />
                </div>

                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <div className="flex justify-between pt-4">
                  <Button variant="secondary" onClick={() => setCurrentStep(2)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Anterior
                  </Button>
                  <Button
                    onClick={handleCreateInvoice}
                    disabled={createInvoice.isPending}
                  >
                    {createInvoice.isPending ? 'Registrando...' : 'Registrar Factura'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}
