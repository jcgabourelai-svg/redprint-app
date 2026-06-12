import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/formatters'
import { useCreateInvoice } from '@/hooks/useInvoices'
import { parseApiError } from '@/lib/api-errors'

const steps = [
  { id: '1', label: 'Datos Generales' },
  { id: '2', label: 'Impresoras y Contratos' },
  { id: '3', label: 'Revisión' },
]

const mockClientes = [
  { value: 'CLI-001', label: 'Empresa Alpha S.A. de C.V.' },
  { value: 'CLI-002', label: 'Grupo Beta México' },
  { value: 'CLI-003', label: 'Corporativo Gamma' },
  { value: 'CLI-004', label: 'Soluciones Delta S.C.' },
  { value: 'CLI-005', label: 'Tecnologías Epsilon' },
  { value: 'CLI-006', label: 'Industrias Zeta' },
]

export default function RegisterInvoicePage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [form, setForm] = useState({
    numero: '',
    cliente_id: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '',
    periodo_inicio: '',
    periodo_fin: '',
    metodo_calculo: 'lecturas',
    selected_contratos: [] as string[],
    selected_impresoras: [] as string[],
    notas: '',
  })
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleCreateInvoice = async () => {
    setError('')
    try {
      await createInvoice.mutateAsync({
        numero: form.numero,
        cliente_id: form.cliente_id,
        fecha_emision: form.fecha_emision,
        fecha_vencimiento: form.fecha_vencimiento,
        periodo_inicio: form.periodo_inicio,
        periodo_fin: form.periodo_fin,
        notas: form.notas,
      })
      navigate('/finanzas/cuentas-por-cobrar')
    } catch (err) {
      setError(parseApiError(err))
    }
  }

  return (
    <PageLayout title="Registrar Factura">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Registrar Factura</h2>
            <p className="text-sm text-gray-500">Registro manual de factura emitida en PAC externo</p>
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
                  ? 'bg-blue-500 text-white'
                  : currentStep > index + 1
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {currentStep > index + 1 ? <Check className="h-4 w-4" /> : <span className="w-5 h-5 rounded-full bg-current bg-opacity-20 flex items-center justify-center text-xs">{index + 1}</span>}
                {step.label}
              </div>
              {index < steps.length - 1 && (
                <div className={`w-8 h-0.5 mx-1 ${currentStep > index + 1 ? 'bg-green-400' : 'bg-gray-300'}`} />
              )}
            </div>
          ))}
        </div>

        <Card>
          <CardContent className="p-6">
            {currentStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Paso 1 de 3: Datos Generales de la Factura</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número de factura (del PAC externo) *</label>
                  <Input
                    value={form.numero}
                    onChange={(e) => setForm({ ...form, numero: e.target.value })}
                    placeholder="F-001"
                    error={error && !form.numero ? 'Requerido' : undefined}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                  <Select
                    options={mockClientes}
                    value={form.cliente_id}
                    onChange={(v) => setForm({ ...form, cliente_id: v, selected_contratos: [], selected_impresoras: [] })}
                    placeholder="Seleccionar cliente"
                    searchable
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de emisión *</label>
                  <Input
                    type="date"
                    value={form.fecha_emision}
                    onChange={(e) => setForm({ ...form, fecha_emision: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de vencimiento *</label>
                  <Input
                    type="date"
                    value={form.fecha_vencimiento}
                    onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Periodo inicio *</label>
                    <Input
                      type="date"
                      value={form.periodo_inicio}
                      onChange={(e) => setForm({ ...form, periodo_inicio: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Periodo fin *</label>
                    <Input
                      type="date"
                      value={form.periodo_fin}
                      onChange={(e) => setForm({ ...form, periodo_fin: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Método de cálculo *</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="metodo" value="lecturas" checked={form.metodo_calculo === 'lecturas'} onChange={() => setForm({ ...form, metodo_calculo: 'lecturas' })} className="text-blue-500" />
                      <span className="text-sm">Según lecturas registradas (recomendado)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="metodo" value="manual" checked={form.metodo_calculo === 'manual'} onChange={() => setForm({ ...form, metodo_calculo: 'manual' })} className="text-blue-500" />
                      <span className="text-sm">Monto manual</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="secondary" onClick={() => navigate('/finanzas/cuentas-por-cobrar')}>Cancelar</Button>
                  <Button onClick={() => setCurrentStep(2)} disabled={!form.numero || !form.cliente_id}>
                    Siguiente <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Paso 2 de 3: Impresoras y Contratos</h3>

                {form.cliente_id && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm">Cliente seleccionado: <strong>{mockClientes.find(c => c.value === form.cliente_id)?.label}</strong></p>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Seleccione impresoras:</h4>
                  <p className="text-sm text-gray-500">Las impresoras se cargarán desde el sistema al seleccionar un cliente.</p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm font-medium">El cálculo se realizará al registrar la factura</p>
                </div>

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
                <h3 className="text-lg font-semibold text-gray-900">Paso 3 de 3: Revisión y Confirmación</h3>

                <Card>
                  <CardHeader>
                    <CardTitle>Resumen de la Factura</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <p>Número de factura: <strong>{form.numero}</strong></p>
                      <p>Cliente: <strong>{mockClientes.find(c => c.value === form.cliente_id)?.label}</strong></p>
                      <p>Fecha de emisión: <strong>{form.fecha_emision}</strong></p>
                      <p>Fecha de vencimiento: <strong>{form.fecha_vencimiento}</strong></p>
                      <p>Periodo: <strong>{form.periodo_inicio} - {form.periodo_fin}</strong></p>
                    </div>
                  </CardContent>
                </Card>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                  <textarea
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    value={form.notas}
                    onChange={(e) => setForm({ ...form, notas: e.target.value })}
                    placeholder="Notas adicionales..."
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">{error}</p>
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
