import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/EmptyState'
import { useCreateContract } from '@/hooks/useContracts'
import { useClients } from '@/hooks/useClients'
import { usePrinters } from '@/hooks/usePrinters'
import { formatCurrency } from '@/lib/utils'
import { PrinterStatus, PRINTER_STATUS_LABELS } from '@/types/enums'
import type { Printer } from '@/types/models'

const STEPS = ['Cliente', 'Impresoras', 'Tarifas', 'Resumen']

const FREQUENCY_OPTIONS = [
  { value: 'MENSUAL', label: 'Mensual' },
  { value: 'QUINCENAL', label: 'Quincenal' },
  { value: 'SEMANAL', label: 'Semanal' },
  { value: 'CUSTOM', label: 'Personalizada' },
]

const FREQUENCY_LABELS: Record<string, string> = {
  MENSUAL: 'Mensual',
  QUINCENAL: 'Quincenal',
  SEMANAL: 'Semanal',
  CUSTOM: 'Personalizada',
}

interface SelectedPrinter {
  printer: Printer
  initialReading: string
}

export default function CreateContract() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedClientId = searchParams.get('cliente_id')

  const [step, setStep] = useState(0)
  const [selectedClientId, setSelectedClientId] = useState(preselectedClientId ?? '')
  const [selectedPrinters, setSelectedPrinters] = useState<SelectedPrinter[]>([])
  const [tariffs, setTariffs] = useState({
    tarifa_base: '',
    paginas_incluidas: '',
    costo_pag_excedente: '',
    dias_gracia: '5',
    frecuencia_visitas: 'MENSUAL',
    dias_adelanto: '3',
  })

  const { data: clientsData, isLoading: clientsLoading } = useClients({ per_page: 100 })
  const { data: printersData, isLoading: printersLoading } = usePrinters({
    estado: PrinterStatus.EN_ALMACEN,
    per_page: 100,
  })
  const createMutation = useCreateContract()

  const clients = clientsData?.data ?? []
  const printers = printersData?.data ?? []
  const selectedClient = clients.find((c) => c.id === Number(selectedClientId))

  const canGoNext = () => {
    switch (step) {
      case 0: return !!selectedClientId
      case 1: return true
      case 2: return !!tariffs.tarifa_base && !!tariffs.paginas_incluidas && !!tariffs.costo_pag_excedente
      case 3: return true
      default: return false
    }
  }

  const togglePrinter = (printer: Printer) => {
    setSelectedPrinters((prev) => {
      const exists = prev.find((sp) => sp.printer.id === printer.id)
      if (exists) return prev.filter((sp) => sp.printer.id !== printer.id)
      return [...prev, { printer, initialReading: '' }]
    })
  }

  const updateInitialReading = (printerId: number, value: string) => {
    setSelectedPrinters((prev) =>
      prev.map((sp) =>
        sp.printer.id === printerId ? { ...sp, initialReading: value } : sp
      )
    )
  }

  const handleCreate = () => {
    const data: Record<string, unknown> = {
      cliente_id: Number(selectedClientId),
      tarifa_base: Number(tariffs.tarifa_base),
      paginas_incluidas: Number(tariffs.paginas_incluidas),
      costo_pag_excedente: Number(tariffs.costo_pag_excedente),
      dias_gracia: Number(tariffs.dias_gracia),
      frecuencia_visitas: tariffs.frecuencia_visitas,
      dias_adelanto: Number(tariffs.dias_adelanto),
      impresoras: selectedPrinters.map((sp) => ({
        impresora_id: sp.printer.id,
        lectura_inicial: sp.initialReading ? Number(sp.initialReading) : undefined,
      })),
    }

    createMutation.mutate(data, {
      onSuccess: (result: { id?: number }) => {
        navigate(`/contratos/${result?.id}`)
      },
    })
  }

  return (
    <PageLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Nuevo Contrato</h1>
          <Button variant="outline" onClick={() => navigate('/contratos')}>
            Cancelar
          </Button>
        </div>

        <div className="flex items-center justify-center gap-2">
          {STEPS.map((label, idx) => (
            <div key={label} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    idx < step
                      ? 'bg-primary text-primary-foreground'
                      : idx === step
                        ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {idx < step ? <Check className="h-4 w-4" /> : idx + 1}
                </div>
                <span className="mt-1 text-xs text-muted-foreground hidden sm:block">{label}</span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`h-0.5 w-8 sm:w-12 mx-1 ${idx < step ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            {step === 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Seleccionar Cliente</h3>
                {clientsLoading ? (
                  <LoadingSpinner text="Cargando clientes..." />
                ) : preselectedClientId && selectedClient ? (
                  <div className="rounded-lg border p-4 space-y-2">
                    <p className="text-sm text-muted-foreground">Cliente preseleccionado</p>
                    <p className="font-medium text-lg">{selectedClient.razon_social}</p>
                    <p className="text-sm">RFC: {selectedClient.rfc ?? '—'}</p>
                    <p className="text-sm">Contacto: {selectedClient.nombre_contacto}</p>
                  </div>
                ) : (
                  <Select
                    id="client"
                    label="Cliente"
                    options={clients.map((c) => ({ value: String(c.id), label: c.razon_social }))}
                    placeholder="Selecciona un cliente"
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                  />
                )}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Asignar Impresoras</h3>
                <p className="text-sm text-muted-foreground">Selecciona las impresoras en almacen para asignar al contrato</p>
                {printersLoading ? (
                  <LoadingSpinner text="Cargando impresoras..." />
                ) : printers.length === 0 ? (
                  <EmptyState title="Sin impresoras disponibles" description="No hay impresoras en almacen" />
                ) : (
                  <div className="rounded-lg border overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="p-3 text-left w-10"></th>
                          <th className="p-3 text-left font-medium text-muted-foreground">Codigo</th>
                          <th className="p-3 text-left font-medium text-muted-foreground">Marca / Modelo</th>
                          <th className="p-3 text-left font-medium text-muted-foreground">Num. Serie</th>
                          <th className="p-3 text-left font-medium text-muted-foreground">Lectura Inicial</th>
                        </tr>
                      </thead>
                      <tbody>
                        {printers.map((printer) => {
                          const isSelected = selectedPrinters.some((sp) => sp.printer.id === printer.id)
                          const sp = selectedPrinters.find((sp) => sp.printer.id === printer.id)
                          return (
                            <tr
                              key={printer.id}
                              className={`border-b cursor-pointer transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
                              onClick={() => togglePrinter(printer)}
                            >
                              <td className="p-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => togglePrinter(printer)}
                                  className="h-4 w-4 rounded border-input"
                                />
                              </td>
                              <td className="p-3 font-medium">{printer.codigo_negocio}</td>
                              <td className="p-3">{printer.marca} {printer.modelo}</td>
                              <td className="p-3">{printer.num_serie}</td>
                              <td className="p-3" onClick={(e) => e.stopPropagation()}>
                                {isSelected && (
                                  <input
                                    type="number"
                                    placeholder="Opcional"
                                    value={sp?.initialReading ?? ''}
                                    onChange={(e) => updateInitialReading(printer.id, e.target.value)}
                                    className="h-8 w-28 rounded border border-input bg-background px-2 text-sm"
                                  />
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 max-w-lg">
                <h3 className="text-lg font-semibold">Configurar Tarifas</h3>
                <Input
                  id="tarifa_base"
                  label="Tarifa Base (MXN)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={tariffs.tarifa_base}
                  onChange={(e) => setTariffs((p) => ({ ...p, tarifa_base: e.target.value }))}
                  required
                />
                <Input
                  id="paginas_incluidas"
                  label="Paginas Incluidas"
                  type="number"
                  min="0"
                  value={tariffs.paginas_incluidas}
                  onChange={(e) => setTariffs((p) => ({ ...p, paginas_incluidas: e.target.value }))}
                  required
                />
                <Input
                  id="costo_pag_excedente"
                  label="Costo Pagina Excedente (MXN)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={tariffs.costo_pag_excedente}
                  onChange={(e) => setTariffs((p) => ({ ...p, costo_pag_excedente: e.target.value }))}
                  required
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    id="dias_gracia"
                    label="Dias de Gracia"
                    type="number"
                    min="0"
                    value={tariffs.dias_gracia}
                    onChange={(e) => setTariffs((p) => ({ ...p, dias_gracia: e.target.value }))}
                  />
                  <Input
                    id="dias_adelanto"
                    label="Dias de Adelanto"
                    type="number"
                    min="0"
                    value={tariffs.dias_adelanto}
                    onChange={(e) => setTariffs((p) => ({ ...p, dias_adelanto: e.target.value }))}
                  />
                </div>
                <Select
                  id="frecuencia_visitas"
                  label="Frecuencia de Visitas"
                  options={FREQUENCY_OPTIONS}
                  value={tariffs.frecuencia_visitas}
                  onChange={(e) => setTariffs((p) => ({ ...p, frecuencia_visitas: e.target.value }))}
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Resumen del Contrato</h3>

                <div className="rounded-lg border p-4 space-y-3">
                  <h4 className="font-medium">Cliente</h4>
                  <p>{selectedClient?.razon_social ?? '—'}</p>
                  <p className="text-sm text-muted-foreground">RFC: {selectedClient?.rfc ?? '—'}</p>
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <h4 className="font-medium">Impresoras ({selectedPrinters.length})</h4>
                  {selectedPrinters.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin impresoras asignadas</p>
                  ) : (
                    <ul className="space-y-2">
                      {selectedPrinters.map((sp) => (
                        <li key={sp.printer.id} className="text-sm flex justify-between">
                          <span>{sp.printer.codigo_negocio} — {sp.printer.marca} {sp.printer.modelo}</span>
                          {sp.initialReading && <span className="text-muted-foreground">Lectura: {sp.initialReading}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <h4 className="font-medium">Tarifas</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <p className="text-muted-foreground">Tarifa Base:</p>
                    <p className="font-medium">{formatCurrency(Number(tariffs.tarifa_base))}</p>
                    <p className="text-muted-foreground">Paginas Incluidas:</p>
                    <p className="font-medium">{tariffs.paginas_incluidas}</p>
                    <p className="text-muted-foreground">Costo Pag. Excedente:</p>
                    <p className="font-medium">{formatCurrency(Number(tariffs.costo_pag_excedente))}</p>
                    <p className="text-muted-foreground">Dias Gracia:</p>
                    <p className="font-medium">{tariffs.dias_gracia}</p>
                    <p className="text-muted-foreground">Frecuencia:</p>
                    <p className="font-medium">{FREQUENCY_LABELS[tariffs.frecuencia_visitas]}</p>
                    <p className="text-muted-foreground">Dias Adelanto:</p>
                    <p className="font-medium">{tariffs.dias_adelanto}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t mt-6">
              <Button
                variant="outline"
                onClick={() => step === 0 ? navigate('/contratos') : setStep((s) => s - 1)}
              >
                {step === 0 ? 'Cancelar' : 'Anterior'}
              </Button>
              {step < 3 ? (
                <Button onClick={() => setStep((s) => s + 1)} disabled={!canGoNext()}>
                  Siguiente
                </Button>
              ) : (
                <Button onClick={handleCreate} loading={createMutation.isPending}>
                  Crear Contrato
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}
