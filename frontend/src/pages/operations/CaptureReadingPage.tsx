import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useVisits } from '@/hooks/useVisits'
import { useContract } from '@/hooks/useContracts'
import { useCreateReading } from '@/hooks/useReadings'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

const readingEntrySchema = z.object({
  impresora_id: z.number(),
  valor_contador: z.number().min(0, 'El valor debe ser mayor o igual a 0'),
  justificacion_anomalia: z.string().optional(),
})

type ReadingEntry = z.infer<typeof readingEntrySchema>

const captureSchema = z.object({
  visita_id: z.coerce.number().min(1, 'Selecciona una visita'),
  lecturas: z.array(readingEntrySchema),
})

type CaptureForm = z.infer<typeof captureSchema>

export default function CaptureReadingPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const createReading = useCreateReading()
  const [selectedVisitId, setSelectedVisitId] = useState<number | null>(null)

  const { data: visitsData, isLoading: visitsLoading } = useVisits({
    estado: 'PENDIENTE',
    per_page: 100,
  })
  const pendingVisits = visitsData?.data ?? []

  const selectedVisit = pendingVisits.find((v) => v.id === selectedVisitId)
  const contractId = selectedVisit?.contrato_id

  const { data: contract } = useContract(contractId ?? 0)
  const printers = contract?.printers ?? []

  const visitOptions = pendingVisits.map((v) => ({
    value: String(v.id),
    label: `${v.client?.razon_social ?? `Cliente #${v.cliente_id}`} - ${v.fecha_programada}`,
  }))

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CaptureForm>({
    resolver: zodResolver(captureSchema),
    defaultValues: { visita_id: 0, lecturas: [] },
  })

  const [counterValues, setCounterValues] = useState<Record<number, number>>({})
  const [justifications, setJustifications] = useState<Record<number, string>>({})

  const calculations = useMemo(() => {
    const results: Record<number, { pages: number; estimated: number; isAnomaly: boolean; previousReading: number }> = {}
    for (const printer of printers) {
      const current = counterValues[printer.id] ?? 0
      const previous = printer.contador_actual
      const pages = Math.max(0, current - previous)
      const isAnomaly = current < previous
      let estimated = contract?.tarifa_base ?? 0
      const included = contract?.paginas_incluidas ?? 0
      const excessCost = contract?.costo_pag_excedente ?? 0
      if (pages > included) {
        estimated += (pages - included) * excessCost
      }
      results[printer.id] = { pages, estimated, isAnomaly, previousReading: previous }
    }
    return results
  }, [counterValues, printers, contract])

  const onSubmit = async () => {
    if (!selectedVisitId) return

    const hasAnomalyWithoutJustification = printers.some((p) => {
      const calc = calculations[p.id]
      return calc?.isAnomaly && !justifications[p.id]?.trim()
    })

    if (hasAnomalyWithoutJustification) {
      addToast('Las anomalias requieren justificacion', 'error')
      return
    }

    try {
      for (const printer of printers) {
        const current = counterValues[printer.id]
        if (current === undefined) continue
        const calc = calculations[printer.id]
        await createReading.mutateAsync({
          visita_id: selectedVisitId,
          impresora_id: printer.id,
          contrato_id: contractId,
          valor_contador: current,
          paginas_periodo: calc?.pages ?? 0,
          es_anomalia: calc?.isAnomaly ?? false,
          justificacion_anomalia: calc?.isAnomaly ? justifications[printer.id] : null,
        })
      }
      addToast('Lecturas registradas correctamente', 'success')
      navigate('/lecturas')
    } catch {
      addToast('Error al registrar lecturas', 'error')
    }
  }

  if (visitsLoading) return <LoadingSpinner text="Cargando visitas pendientes..." />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Capturar Lectura</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registra las lecturas de contadores para una visita
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Seleccionar Visita</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              label="Visita Pendiente"
              options={visitOptions}
              placeholder="Selecciona una visita"
              value={selectedVisitId ? String(selectedVisitId) : ''}
              onChange={(e) => {
                const id = Number(e.target.value)
                setSelectedVisitId(id || null)
                setValue('visita_id', id)
                setCounterValues({})
                setJustifications({})
              }}
              error={errors.visita_id?.message}
            />
            {selectedVisit && (
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Cliente: </span>
                  <span className="font-medium">{selectedVisit.client?.razon_social}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fecha programada: </span>
                  <span className="font-medium">{selectedVisit.fecha_programada}</span>
                </div>
                {contract && (
                  <>
                    <div>
                      <span className="text-muted-foreground">Tarifa base: </span>
                      <span className="font-medium">{formatCurrency(contract.tarifa_base)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Paginas incluidas: </span>
                      <span className="font-medium">{contract.paginas_incluidas}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {printers.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Lecturas por Impresora</h3>
            {printers.map((printer) => {
              const calc = calculations[printer.id]
              return (
                <Card key={printer.id}>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">
                            {printer.marca} {printer.modelo}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Serie: {printer.num_serie}
                          </p>
                        </div>
                        {calc?.isAnomaly && (
                          <Badge variant="error">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Anomalia
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Input
                          label="Lectura anterior"
                          value={calc?.previousReading.toLocaleString() ?? '0'}
                          disabled
                        />
                        <Input
                          label="Valor contador actual"
                          type="number"
                          min={0}
                          value={counterValues[printer.id] ?? ''}
                          onChange={(e) =>
                            setCounterValues((prev) => ({
                              ...prev,
                              [printer.id]: Number(e.target.value),
                            }))
                          }
                        />
                        <Input
                          label="Paginas consumidas"
                          value={calc?.pages.toLocaleString() ?? '0'}
                          disabled
                        />
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Monto estimado: </span>
                          <span className="font-semibold">{formatCurrency(calc?.estimated ?? 0)}</span>
                        </div>
                      </div>

                      {calc?.isAnomaly && (
                        <div className="rounded-md border border-warning/30 bg-warning/5 p-3 space-y-2">
                          <div className="flex items-center gap-2 text-warning">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              Anomalia detectada: el contador actual es menor al anterior
                            </span>
                          </div>
                          <Textarea
                            label="Justificacion de anomalia (requerido)"
                            value={justifications[printer.id] ?? ''}
                            onChange={(e) =>
                              setJustifications((prev) => ({
                                ...prev,
                                [printer.id]: e.target.value,
                              }))
                            }
                            placeholder="Explica la razon de la anomalia..."
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {selectedVisitId && printers.length === 0 && contract && (
          <div className="text-center py-8 text-muted-foreground">
            No hay impresoras asignadas a este contrato
          </div>
        )}

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/lecturas')}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={printers.length === 0}>
            Registrar Lecturas
          </Button>
        </div>
      </form>
    </div>
  )
}
