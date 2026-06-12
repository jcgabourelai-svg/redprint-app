import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Printer,
  FileText,
  DollarSign,
  ClipboardCheck,
} from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { useClients } from '@/hooks/useClients'
import { usePrinters } from '@/hooks/usePrinters'
import { useCreateContract } from '@/hooks/useContracts'
import type { VisitFrequency } from '@/types/contract'
import { formatCurrency } from '@/lib/formatters'
import { parseApiError } from '@/lib/api-errors'

const stepLabels = ['Datos Generales', 'Impresoras', 'Configurar Tarifa', 'Confirmación']
const stepIcons = [FileText, Printer, DollarSign, ClipboardCheck]

const frecuenciaOptions = [
  { value: 'MENSUAL', label: 'Mensual' },
  { value: 'QUINCENAL', label: 'Quincenal' },
  { value: 'SEMANAL', label: 'Semanal' },
  { value: 'CUSTOM', label: 'Personalizado' },
]

const presetLabels: Record<string, { tarifa_base: number; paginas_incluidas: number; costo_por_pagina_excedente: number }> = {
  renta_fija: { tarifa_base: 1500, paginas_incluidas: 999999, costo_por_pagina_excedente: 0 },
  puro_consumo: { tarifa_base: 0, paginas_incluidas: 0, costo_por_pagina_excedente: 0.02 },
  estandar: { tarifa_base: 1500, paginas_incluidas: 500, costo_por_pagina_excedente: 0.01 },
}

export default function CreateContract() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState('')

  const { data: clientsData, isLoading: clientsLoading } = useClients()
  const { data: printersData, isLoading: printersLoading } = usePrinters({ estado: 'EN_ALMACEN' })
  const createContract = useCreateContract()

  const clients = clientsData?.data || []
  const printers = printersData?.data || []

  const [cliente_id, setClienteId] = useState('')
  const [fecha_inicio, setFechaInicio] = useState('2026-05-15')
  const [fecha_fin, setFechaFin] = useState('')
  const [dias_gracia, setDiasGracia] = useState('15')
  const [frecuencia, setFrecuencia] = useState<VisitFrequency>('MENSUAL')

  const [selectedPrinters, setSelectedPrinters] = useState<string[]>([])
  const [lecturas_iniciales, setLecturasIniciales] = useState<Record<string, string>>({})

  const [tarifa_base, setTarifaBase] = useState('1500')
  const [paginas_incluidas, setPaginasIncluidas] = useState('500')
  const [costo_por_pagina_excedente, setCostoPorPagina] = useState('0.01')

  const clientOptions = clients.map((c) => ({
    value: c.id,
    label: `${c.razon_social} (${c.nombre_contacto})`,
  }))

  const selectedClient = clients.find((c) => c.id === cliente_id)
  const selectedPrinterDetails = printers.filter((p) => selectedPrinters.includes(p.id))

  const canNext = () => {
    if (step === 0) return !!cliente_id && !!fecha_inicio
    if (step === 1) return selectedPrinters.length > 0
    if (step === 2) return true
    return true
  }

  const handleNext = () => {
    if (step < 3) setStep(step + 1)
    else setShowConfirm(true)
  }

  const handlePrev = () => {
    if (step > 0) setStep(step - 1)
  }

  const handleCreate = () => {
    setError('')
    const contractData = {
      cliente_id: parseInt(cliente_id),
      fecha_inicio,
      fecha_fin: fecha_fin || null,
      dias_gracia: parseInt(dias_gracia),
      frecuencia_visitas: frecuencia,
      tarifa_base: parseFloat(tarifa_base),
      paginas_incluidas: parseInt(paginas_incluidas),
      costo_por_pagina_excedente: parseFloat(costo_por_pagina_excedente),
      impresoras: selectedPrinters.map((printerId) => ({
        impresora_id: printerId,
        lectura_inicial: parseInt(lecturas_iniciales[printerId]) || 0,
      })),
    }
    
    createContract.mutate(contractData, {
      onSuccess: () => {
        setShowConfirm(false)
        setShowSuccess(true)
      },
      onError: (err) => {
        setError(parseApiError(err))
      },
    })
  }

  const handleSuccessClose = () => {
    setShowSuccess(false)
    navigate('/contratos')
  }

  const togglePrinter = (id: string) => {
    setSelectedPrinters((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  if (clientsLoading || printersLoading) {
    return (
      <PageLayout title="Contratos › Crear Nuevo Contrato">
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Cargando datos necesarios...</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Contratos › Crear Nuevo Contrato">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/contratos')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-8">
              {stepLabels.map((label, i) => {
                const Icon = stepIcons[i]
                const isActive = i === step
                const isCompleted = i < step
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                        isActive
                          ? 'bg-blue-500 text-white'
                          : isCompleted
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <span className={`text-sm hidden sm:inline ${isActive ? 'font-medium text-blue-600' : 'text-gray-500'}`}>
                      {label}
                    </span>
                    {i < stepLabels.length - 1 && (
                      <div className={`w-8 lg:w-16 h-0.5 mx-1 ${i < step ? 'bg-green-500' : 'bg-gray-200'}`} />
                    )}
                  </div>
                )
              })}
            </div>

            <p className="text-lg font-semibold mb-6">
              PASO {step + 1} DE 4: {stepLabels[step]}
            </p>

            {step === 0 && (
              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                  <Select
                    options={clientOptions}
                    value={cliente_id}
                    onChange={setClienteId}
                    placeholder="Seleccionar cliente..."
                    searchable
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de inicio *</label>
                  <Input
                    type="date"
                    value={fecha_inicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de fin (opcional, vacío = indefinido)
                  </label>
                  <Input
                    type="date"
                    value={fecha_fin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    placeholder="Dejar indefinido"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Días de gracia para pago *</label>
                  <Input
                    type="number"
                    value={dias_gracia}
                    onChange={(e) => setDiasGracia(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia de visitas *</label>
                  <Select
                    options={frecuenciaOptions}
                    value={frecuencia}
                    onChange={(v) => setFrecuencia(v as VisitFrequency)}
                  />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                {selectedClient && (
                  <div className="bg-blue-50 rounded-lg p-3 text-sm">
                    <p className="font-medium text-blue-800">Cliente: {selectedClient.razon_social} ({selectedClient.nombre_contacto})</p>
                    <p className="text-blue-600">RFC: {selectedClient.rfc || '-'}</p>
                  </div>
                )}
                <p className="text-sm text-gray-600">Impresoras disponibles en almacén:</p>
                <div className="space-y-3">
                  {printers.map((printer) => {
                    const isSelected = selectedPrinters.includes(printer.id)
                    return (
                      <div
                        key={printer.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                          isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => togglePrinter(printer.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded border ${
                              isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {printer.id} - {printer.marca} {printer.modelo}
                            </p>
                            <p className="text-xs text-gray-500">SERIE: {printer.numero_serie}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-xs">
                              <div>
                                <span className="text-gray-400">Costo:</span>{' '}
                                <span className="text-gray-700">{formatCurrency(printer.costo_adquisicion)}</span>
                              </div>
                              <div>
                                <span className="text-gray-400">Contador:</span>{' '}
                                <span className="text-gray-700">{printer.contador_total_actual.toLocaleString('es-MX')} hojas</span>
                              </div>
                              <div>
                                <span className="text-gray-400">Almacén:</span>{' '}
                                <span className="text-gray-700">{printer.almacen || '-'}</span>
                              </div>
                              <div>
                                <Badge variant="printer_status" color={printer.estado}>
                                  EN ALMACÉN
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="text-sm text-gray-500">
                  Seleccionadas: {selectedPrinters.length} impresora(s)
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 max-w-lg">
                {selectedClient && (
                  <p className="text-sm text-gray-600">
                    Cliente: <span className="font-medium">{selectedClient.razon_social}</span> • Impresoras: {selectedPrinters.length}
                  </p>
                )}

                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                  <code>monto = tarifa_base + max(0, páginas - incluidas) × costo_por_pagina_excedente</code>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    const p = presetLabels.renta_fija
                    setTarifaBase(String(p.tarifa_base))
                    setPaginasIncluidas(String(p.paginas_incluidas))
                    setCostoPorPagina(String(p.costo_por_pagina_excedente))
                  }}>
                    Renta fija pura
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    const p = presetLabels.puro_consumo
                    setTarifaBase(String(p.tarifa_base))
                    setPaginasIncluidas(String(p.paginas_incluidas))
                    setCostoPorPagina(String(p.costo_por_pagina_excedente))
                  }}>
                    Puro consumo
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    const p = presetLabels.estandar
                    setTarifaBase(String(p.tarifa_base))
                    setPaginasIncluidas(String(p.paginas_incluidas))
                    setCostoPorPagina(String(p.costo_por_pagina_excedente))
                  }}>
                    Estándar
                  </Button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tarifa base mensual ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={tarifa_base}
                    onChange={(e) => setTarifaBase(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Páginas incluidas</label>
                  <Input
                    type="number"
                    value={paginas_incluidas}
                    onChange={(e) => setPaginasIncluidas(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Costo por página excedente ($)</label>
                  <Input
                    type="number"
                    step="0.001"
                    value={costo_por_pagina_excedente}
                    onChange={(e) => setCostoPorPagina(e.target.value)}
                  />
                </div>

                {selectedPrinterDetails.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Lecturas iniciales de contador:</p>
                    <div className="space-y-3">
                      {selectedPrinterDetails.map((printer) => (
                        <div key={printer.id} className="flex items-center gap-3">
                          <span className="text-sm text-gray-600 min-w-[200px]">
                            {printer.id} - {printer.marca} {printer.modelo}
                          </span>
                          <Input
                            type="number"
                            placeholder="0 (por defecto)"
                            value={lecturas_iniciales[printer.id] || ''}
                            onChange={(e) =>
                              setLecturasIniciales({ ...lecturas_iniciales, [printer.id]: e.target.value })
                            }
                            className="w-40"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="font-medium text-blue-900 mb-2">Resumen del Contrato</p>
                  <div className="grid gap-2 sm:grid-cols-2 text-sm">
                    <div>
                      <span className="text-blue-600">Cliente:</span>{' '}
                      <span className="font-medium">{selectedClient?.razon_social} ({selectedClient?.nombre_contacto})</span>
                    </div>
                    <div>
                      <span className="text-blue-600">RFC:</span>{' '}
                      <span className="font-medium">{selectedClient?.rfc || '-'}</span>
                    </div>
                    {selectedClient?.correo && (
                      <div>
                        <span className="text-blue-600">Contacto:</span>{' '}
                        <span className="font-medium">{selectedClient.telefono}, {selectedClient.correo}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <p className="font-medium text-green-900 mb-2">Fechas del Contrato</p>
                  <div className="grid gap-2 sm:grid-cols-2 text-sm">
                    <div>
                      <span className="text-green-600">Inicio:</span>{' '}
                      <span className="font-medium">{fecha_inicio}</span>
                    </div>
                    <div>
                      <span className="text-green-600">Fin:</span>{' '}
                      <span className="font-medium">{fecha_fin || 'Indefinido (renovación tácita)'}</span>
                    </div>
                    <div>
                      <span className="text-green-600">Días de gracia:</span>{' '}
                      <span className="font-medium">{dias_gracia} días</span>
                    </div>
                    <div>
                      <span className="text-green-600">Frecuencia:</span>{' '}
                      <span className="font-medium capitalize">{frecuencia}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 rounded-lg p-4">
                  <p className="font-medium text-amber-900 mb-2">Esquema de Cobro</p>
                  <div className="bg-white rounded p-2 text-sm font-mono mb-2">
                    tarifa_base + max(0, p - {paginas_incluidas}) × {costo_por_pagina_excedente}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3 text-sm">
                    <div>
                      <span className="text-amber-600">Tarifa base:</span>{' '}
                      <span className="font-medium">{formatCurrency(Number(tarifa_base))}</span>
                    </div>
                    <div>
                      <span className="text-amber-600">Páginas incluidas:</span>{' '}
                      <span className="font-medium">{Number(paginas_incluidas).toLocaleString('es-MX')}</span>
                    </div>
                    <div>
                      <span className="text-amber-600">Costo excedente:</span>{' '}
                      <span className="font-medium">{formatCurrency(Number(costo_por_pagina_excedente))}/página</span>
                    </div>
                  </div>
                </div>

                {selectedPrinterDetails.length > 0 && (
                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="font-medium text-purple-900 mb-2">
                      Impresoras Asignadas ({selectedPrinterDetails.length})
                    </p>
                    <div className="space-y-2">
                      {selectedPrinterDetails.map((printer) => (
                        <div key={printer.id} className="flex items-center gap-3 text-sm">
                          <Printer className="h-4 w-4 text-purple-600" />
                          <span className="font-medium">{printer.id} - {printer.marca} {printer.modelo}</span>
                          <span className="text-purple-600">SERIE: {printer.numero_serie}</span>
                          <span className="text-gray-500">
                            Lectura: {lecturas_iniciales[printer.id] || '0'} páginas
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                  El sistema generará automáticamente las visitas {frecuencia}es para este cliente.
                </div>
              </div>
            )}

            <div className="flex justify-between pt-6 border-t mt-8">
              <div>
                {step > 0 && (
                  <Button variant="secondary" onClick={handlePrev}>
                    ← Anterior
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => navigate('/contratos')}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!canNext()}
                >
                  {step === 3 ? 'Crear Contrato' : 'Siguiente →'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Modal isOpen={showConfirm} onClose={() => setShowConfirm(false)} title="Confirmar Creación">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">¿Estás seguro de que deseas crear este contrato?</p>
          <div className="text-sm space-y-1">
            <p><span className="text-gray-500">Cliente:</span> {selectedClient?.razon_social}</p>
            <p><span className="text-gray-500">Impresoras:</span> {selectedPrinters.length}</p>
            <p><span className="text-gray-500">Tarifa base:</span> {formatCurrency(Number(tarifa_base))}</p>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
              {error}
            </div>
          )}
          <div className="bg-amber-50 rounded p-3 text-xs text-amber-700 space-y-1">
            <p>• Creará el contrato en estado ACTIVO</p>
            <p>• Cambiará las impresoras a estado RENTADA</p>
            <p>• Generará visitas en el calendario</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowConfirm(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createContract.isPending}>
              {createContract.isPending ? 'Creando...' : 'Crear Contrato'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showSuccess} onClose={handleSuccessClose} title="Contrato Creado Exitosamente">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <Check className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <div>
            <p className="font-medium">Contrato creado para {selectedClient?.razon_social}</p>
            <p className="text-sm text-gray-500">
              {selectedPrinters.length} impresoras asignadas: {selectedPrinters.join(', ')}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Las visitas se han programado en el calendario.
            </p>
          </div>
          <div className="flex justify-center gap-3">
            <Button variant="secondary" onClick={handleSuccessClose}>Cerrar</Button>
            <Button onClick={() => { setShowSuccess(false); navigate('/contratos') }}>
              Ver contratos
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}