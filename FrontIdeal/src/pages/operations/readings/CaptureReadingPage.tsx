import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, CheckCircle, AlertTriangle, Save, X } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import { useVisit } from '@/hooks/useVisits'
import { useCreateReading } from '@/hooks/useReadings'
import type { VisitPrinter } from '@/types/operations'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { parseApiError } from '@/lib/api-errors'

interface ReadingState {
  printerId: string
  visitPrinterId: string
  lectura_actual: string
  anomalia: boolean
  justificacion: string
  fotoTomada: boolean
}

export default function CaptureReadingPage() {
  const { visitaId } = useParams<{ visitaId: string }>()
  const navigate = useNavigate()
  const idNum = parseInt(visitaId || '0')

  const { data: visit, isLoading, error } = useVisit(idNum)
  const createReading = useCreateReading()

  const [readings, setReadings] = useState<ReadingState[]>(() => {
    if (!visit) return []
    return visit.impresoras.map((imp) => ({
      printerId: imp.impresora_id,
      visitPrinterId: imp.id,
      lectura_actual: '',
      anomalia: false,
      justificacion: '',
      fotoTomada: false,
    }))
  })

  const [observaciones, setObservaciones] = useState('')
  const [showSavedModal, setShowSavedModal] = useState(false)
  const [anomaliaModal, setAnomaliaModal] = useState<string | null>(null)
  const [saveError, setSaveError] = useState('')

  const costoPorPagina = 1.0

  const readingCalculations = useMemo(() => {
    if (!visit) return []
    return visit.impresoras.map((imp, idx) => {
      const readingState = readings[idx]
      const lectura_actual = parseInt(readingState?.lectura_actual || '0') || 0
      const paginas_consumidas = lectura_actual > imp.lectura_anterior ? lectura_actual - imp.lectura_anterior : 0
      const montoEstimado = paginas_consumidas * costoPorPagina
      const tieneAnomalia = lectura_actual > 0 && lectura_actual < imp.lectura_anterior
      return {
        printerId: imp.impresora_id,
        marca: imp.marca,
        modelo: imp.modelo,
        numero_serie: imp.numero_serie,
        contratoId: imp.contrato_id,
        lectura_anterior: imp.lectura_anterior,
        fecha_lectura_anterior: imp.fecha_lectura_anterior,
        lectura_actual,
        paginas_consumidas,
        montoEstimado,
        tieneAnomalia,
      }
    })
  }, [visit, readings])

  const totals = useMemo(() => {
    const totalPaginas = readingCalculations.reduce((sum, r) => sum + r.paginas_consumidas, 0)
    const totalMonto = readingCalculations.reduce((sum, r) => sum + r.montoEstimado, 0)
    const completadas = readingCalculations.filter((r) => r.lectura_actual > 0 && !r.tieneAnomalia).length
    return { totalPaginas, totalMonto, completadas, total: readingCalculations.length }
  }, [readingCalculations])

  if (!idNum) {
    return (
      <PageLayout title="Visita no encontrada">
        <div className="text-center py-12">
          <p className="text-gray-500">ID de visita inválido</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate('/operaciones/calendario')}>
            Volver al calendario
          </Button>
        </div>
      </PageLayout>
    )
  }

  if (isLoading) {
    return (
      <PageLayout title="Captura de Lectura">
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Cargando visita...</p>
        </div>
      </PageLayout>
    )
  }

  if (error || !visit) {
    return (
      <PageLayout title="Visita no encontrada">
        <div className="text-center py-12">
          <p className="text-red-500">{parseApiError(error)}</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate('/operaciones/calendario')}>
            Volver al calendario
          </Button>
        </div>
      </PageLayout>
    )
  }

  const updateReading = (idx: number, field: keyof ReadingState, value: string | boolean) => {
    setReadings((prev) => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], [field]: value }
      return updated
    })
  }

  const handleSave = () => {
    setSaveError('')
    const validReadings = readingCalculations.filter((r) => r.lectura_actual > 0 && !r.tieneAnomalia)
    
    if (validReadings.length === 0) {
      setSaveError('Debe haber al menos una lectura válida para guardar')
      return
    }

    const readingPromises = validReadings.map((calc) => {
      const readingState = readings.find((r) => r.printerId === calc.printerId)
      return createReading.mutateAsync({
        visita_id: idNum,
        impresora_id: calc.printerId,
        lectura_anterior: calc.lectura_anterior,
        lectura_actual: calc.lectura_actual,
        fecha: new Date().toISOString().split('T')[0],
        hora: new Date().toTimeString().split(' ')[0].substring(0, 5),
        socio_capturista: visit.socio_asignado,
        excepcion: readingState?.anomalia ? readingState.justificacion : undefined,
      })
    })

    Promise.all(readingPromises)
      .then(() => {
        setShowSavedModal(true)
      })
      .catch((err) => {
        setSaveError(parseApiError(err))
      })
  }

  const anomaliaIdx = anomaliaModal ? readings.findIndex((r) => r.visitPrinterId === anomaliaModal) : -1

  return (
    <PageLayout title="Captura de Lectura">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/operaciones/visitas/${visit.id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Visita del {formatDate(visit.fecha_programada)}</p>
                <p className="font-medium text-lg">{visit.cliente_nombre}</p>
              </div>
              <div className="text-right text-sm text-gray-500">
                <p className="flex items-center gap-1">
                  {visit.socio_asignado}
                </p>
                <p>{visit.hora_programada}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Impresoras del cliente ({visit.impresoras.length})
          </h3>
          <div className="space-y-4">
            {visit.impresoras.map((imp, idx) => {
              const calc = readingCalculations[idx]
              const reading = readings[idx]
              return (
                <Card key={imp.id}>
                  <CardContent className="p-4 space-y-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {imp.marca} {imp.modelo}
                      </p>
                      <p className="text-xs text-gray-500">
                        SERIE: {imp.numero_serie} | Contrato: {imp.contrato_id}
                      </p>
                    </div>

                    <div className="text-sm">
                      <p className="text-gray-500">
                        Última lectura: {formatDate(imp.fecha_lectura_anterior)}
                      </p>
                      <p className="text-gray-500">
                        Contador anterior: {imp.lectura_anterior.toLocaleString()} hojas
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Contador actual *
                      </label>
                      <Input
                        type="number"
                        value={reading.lectura_actual}
                        onChange={(e) => {
                          const val = e.target.value
                          updateReading(idx, 'lectura_actual', val)
                          const numVal = parseInt(val) || 0
                          if (numVal > 0 && numVal < imp.lectura_anterior) {
                            updateReading(idx, 'anomalia', true)
                          } else {
                            updateReading(idx, 'anomalia', false)
                          }
                        }}
                        placeholder="Ingrese la lectura actual"
                      />
                    </div>

                    {calc.lectura_actual > 0 && !calc.tieneAnomalia && (
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-600">
                          Páginas del periodo: <span className="font-medium">{calc.paginas_consumidas.toLocaleString()}</span>
                        </span>
                        <span className="flex items-center gap-1 text-green-600">
                          Consumo estimado: {formatCurrency(calc.montoEstimado)}
                          <CheckCircle className="h-4 w-4" />
                        </span>
                      </div>
                    )}

                    {calc.tieneAnomalia && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                          <AlertTriangle className="h-4 w-4" />
                          Lectura menor a la anterior
                        </div>
                        <p className="text-sm text-red-600 mb-2">
                          El contador actual ({calc.lectura_actual.toLocaleString()}) es menor que la
                          última lectura registrada ({imp.lectura_anterior.toLocaleString()}).
                        </p>
                        <div className="text-xs text-red-500 mb-3">
                          <p>Posibles causas:</p>
                          <ul className="list-disc list-inside ml-2">
                            <li>Cambio de tambor/toner</li>
                            <li>Reinicio del contador</li>
                            <li>Error en la lectura</li>
                          </ul>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateReading(idx, 'lectura_actual', '')}
                          >
                            Ingresar valor nuevamente
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAnomaliaModal(imp.id)}
                          >
                            Confirmar anomalía
                          </Button>
                        </div>
                      </div>
                    )}

                    {reading.fotoTomada && (
                      <p className="text-sm text-green-600 flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        Foto capturada
                      </p>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateReading(idx, 'fotoTomada', !reading.fotoTomada)}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      {reading.fotoTomada ? 'Foto capturada' : 'Tomar foto del contador'}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Resumen de la visita</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total páginas:</span>
                <span className="font-medium">{totals.totalPaginas.toLocaleString()} hojas</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total estimado:</span>
                <span className="font-medium">{formatCurrency(totals.totalMonto)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Impresoras:</span>
                <span className="font-medium">
                  {totals.completadas} de {totals.total} completadas
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Observaciones de la visita
          </label>
          <textarea
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Observaciones generales de la visita"
          />
        </div>

        {saveError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
            {saveError}
          </div>
        )}

        <div className="flex justify-end gap-3 pb-4">
          <Button variant="secondary" onClick={() => navigate(`/operaciones/visitas/${visit.id}`)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={totals.completadas === 0 || createReading.isPending}>
            {createReading.isPending ? 'Guardando...' : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar lecturas
              </>
            )}
          </Button>
        </div>
      </div>

      <Modal
        isOpen={showSavedModal}
        onClose={() => {
          setShowSavedModal(false)
          navigate(`/operaciones/visitas/${visit.id}`)
        }}
        title="Lecturas Registradas"
        size="md"
      >
        <div className="space-y-4">
          <div className="text-center mb-4">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <p className="text-lg font-medium">Lecturas guardadas exitosamente</p>
            <p className="text-sm text-gray-500">
              Se han registrado las lecturas de {totals.completadas} impresora(s) para {visit.cliente_nombre}.
            </p>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Resumen:</p>
            {readingCalculations
              .filter((r) => r.lectura_actual > 0 && !r.tieneAnomalia)
              .map((calc) => (
                <div key={calc.printerId} className="text-sm py-1">
                  <p className="font-medium">{calc.marca} {calc.modelo}</p>
                  <p className="text-gray-500 ml-4">
                    Lectura: {calc.lectura_actual.toLocaleString()} | Consumo: {calc.paginas_consumidas.toLocaleString()} | Estimado: {formatCurrency(calc.montoEstimado)}
                  </p>
                </div>
              ))}
            <div className="border-t mt-3 pt-3 text-sm">
              <div className="flex justify-between font-medium">
                <span>Total del periodo:</span>
                <span>{totals.totalPaginas.toLocaleString()} hojas - {formatCurrency(totals.totalMonto)}</span>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-500">
            La visita se ha marcado como completada y las lecturas están disponibles en el historial.
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowSavedModal(false)
                navigate('/operaciones/calendario')
              }}
            >
              Cerrar
            </Button>
            <Button
              onClick={() => {
                setShowSavedModal(false)
                navigate(`/operaciones/visitas/${visit.id}`)
              }}
            >
              Ver visita
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={anomaliaModal !== null}
        onClose={() => setAnomaliaModal(null)}
        title="Confirmar Anomalía"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">
              El contador ingresado es menor a la lectura anterior. Por favor justifique esta anomalía.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Justificación *</label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={anomaliaIdx >= 0 ? readings[anomaliaIdx].justificacion : ''}
              onChange={(e) => {
                if (anomaliaIdx >= 0) {
                  updateReading(anomaliaIdx, 'justificacion', e.target.value)
                }
              }}
              placeholder="Describa el motivo de la anomalía"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setAnomaliaModal(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setAnomaliaModal(null)
              }}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}