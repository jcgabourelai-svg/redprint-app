import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Camera, X } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { Card, CardContent } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { useCreateMaintenanceOrder } from '@/hooks/useMaintenanceOrders'
import { usePrinters } from '@/hooks/usePrinters'
import { useDebounce } from '@/hooks/useDebounce'
import { problemTypeLabels, severityLabels } from '@/lib/maintenanceProblem'
import { compressImage } from '@/lib/photo'
import { parseApiError } from '@/lib/api-errors'

export default function CreateMaintenanceOrder() {
  const navigate = useNavigate()
  const [showConfirm, setShowConfirm] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState('')
  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null)
  const [photoError, setPhotoError] = useState('')

  const [printerSearch, setPrinterSearch] = useState('')
  const debouncedPrinterSearch = useDebounce(printerSearch, 350)
  const { data: printersData, isFetching: printersFetching } = usePrinters(
    debouncedPrinterSearch.trim() !== ''
      ? { search: debouncedPrinterSearch, per_page: 20 }
      : { per_page: 20 },
  )

  const printers = printersData?.data || []

  const tipoOptions = [
    { value: 'preventivo', label: 'Preventivo' },
    { value: 'correctivo', label: 'Correctivo' },
  ]

  const tipoProblemaOptions = [
    { value: '', label: 'Sin especificar' },
    ...Object.entries(problemTypeLabels).map(([value, label]) => ({ value, label })),
  ]

  const severidadOptions = [
    { value: '', label: 'Sin especificar' },
    ...Object.entries(severityLabels).map(([value, label]) => ({ value, label })),
  ]

  const [printerId, setPrinterId] = useState<number | null>(null)
  const [tipo, setTipo] = useState<'preventivo' | 'correctivo'>('preventivo')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [descripcion, setDescripcion] = useState('')
  const [costoManoObra, setCostoManoObra] = useState('')
  const [tipoProblema, setTipoProblema] = useState('')
  const [severidad, setSeveridad] = useState('')
  const [foto, setFoto] = useState<string | null>(null)

  const selectedPrinter = printers.find((p: any) => p.id === printerId)

  const canSubmit = printerId != null && !!fecha && !!descripcion

  const handlePhotoChange = async (file: File | undefined) => {
    setPhotoError('')
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setPhotoError('El archivo debe ser una imagen')
      return
    }
    try {
      const compressed = await compressImage(file)
      if (compressed.length > 1_000_000) {
        setPhotoError('La imagen sigue siendo muy grande tras comprimirla; usa otra con menor resolución')
        return
      }
      setFoto(compressed)
    } catch {
      setPhotoError('No se pudo procesar la imagen')
    }
  }

  const handleSubmit = async () => {
    setShowConfirm(false)
    setError('')
    try {
      const result = await createMutationSubmit()
      setCreatedOrderId(result.id)
      setShowSuccess(true)
    } catch (err) {
      setError(parseApiError(err))
    }
  }

  const createMutation = useCreateMaintenanceOrder()

  const createMutationSubmit = () =>
    createMutation.mutateAsync({
      impresora_id: printerId as number,
      tipo_mantto: tipo.toUpperCase(),
      fecha,
      desc_problema: descripcion,
      costo_mano_obra: costoManoObra ? parseFloat(costoManoObra) : 0,
      tipo_problema: tipoProblema || undefined,
      severidad: tipo === 'correctivo' && severidad ? severidad : undefined,
      foto_evidencia: foto || undefined,
    })

  const handleSuccessClose = () => {
    setShowSuccess(false)
    navigate('/inventario/mantenimiento')
  }

  return (
    <PageLayout title="Inventario › Mantenimiento › Nueva Orden">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/inventario/mantenimiento')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
        </div>

        <Card>
          <CardContent className="p-6">
            {error && (
              <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}
            <h3 className="text-lg font-semibold text-foreground mb-6">
              Nueva Orden de Mantenimiento
            </h3>

            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Impresora *
                </label>
                {printerId != null && selectedPrinter ? (
                  <div className="flex items-center justify-between rounded-md border border-input bg-card px-3 py-2">
                    <span className="text-sm text-foreground">
                      {selectedPrinter.marca} {selectedPrinter.modelo} (#{selectedPrinter.id})
                    </span>
                    <button
                      type="button"
                      onClick={() => setPrinterId(null)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Cambiar impresora"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Input
                      value={printerSearch}
                      onChange={(e) => setPrinterSearch(e.target.value)}
                      placeholder="Buscar por serie, código o modelo..."
                    />
                    <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-border">
                      {printers.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-muted-foreground">
                          {printersFetching ? 'Buscando...' : 'Sin resultados'}
                        </p>
                      ) : (
                        printers.map((p: any) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setPrinterId(p.id)}
                            className="flex w-full items-center justify-between px-3 py-2 text-sm text-left hover:bg-muted"
                          >
                            <span className="truncate">
                              {p.marca} {p.modelo}
                            </span>
                            <span className="ml-2 whitespace-nowrap text-xs text-muted-foreground">
                              {p.num_serie ?? p.codigo_negocio} — {p.estado}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Tipo de Servicio *
                </label>
                <Select
                  options={tipoOptions}
                  value={tipo}
                  onChange={(v) => {
                    setTipo(v as 'preventivo' | 'correctivo')
                    if (v !== 'correctivo') setSeveridad('')
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Tipo de problema
                  </label>
                  <Select
                    options={tipoProblemaOptions}
                    value={tipoProblema}
                    onChange={setTipoProblema}
                    placeholder="Sin especificar"
                  />
                </div>
                {tipo === 'correctivo' && (
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      Severidad
                    </label>
                    <Select
                      options={severidadOptions}
                      value={severidad}
                      onChange={setSeveridad}
                      placeholder="Sin especificar"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Fecha Programada *
                </label>
                <Input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Descripción del Servicio *
                </label>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Describe el servicio de mantenimiento..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Costo de Mano de Obra ($)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={costoManoObra}
                  onChange={(e) => setCostoManoObra(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Foto de evidencia (opcional)
                </label>
                {foto ? (
                  <div className="flex items-start gap-3">
                    <img
                      src={foto}
                      alt="Evidencia seleccionada"
                      className="h-24 rounded-lg border border-border object-cover"
                    />
                    <Button variant="secondary" size="sm" onClick={() => setFoto(null)}>
                      <X className="mr-2 h-4 w-4" />
                      Quitar
                    </Button>
                  </div>
                ) : (
                  <>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-input px-3 py-3 text-sm text-muted-foreground hover:bg-muted/50">
                      <Camera className="h-4 w-4" />
                      Adjuntar imagen (se comprime automáticamente)
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handlePhotoChange(e.target.files?.[0])}
                      />
                    </label>
                    {photoError && (
                      <p className="mt-1 text-xs text-destructive">{photoError}</p>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-6 border-t mt-8">
              <Button
                variant="secondary"
                onClick={() => navigate('/inventario/mantenimiento')}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => setShowConfirm(true)}
                disabled={!canSubmit}
              >
                Crear Orden
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Modal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Confirmar Creación"
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            ¿Estás seguro de que deseas crear esta orden de mantenimiento?
          </p>
          <div className="text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Impresora:</span>{' '}
              {selectedPrinter ? `${selectedPrinter.marca} ${selectedPrinter.modelo} (#${selectedPrinter.id})` : '-'}
            </p>
            <p>
              <span className="text-muted-foreground">Tipo:</span>{' '}
              {tipo === 'preventivo' ? 'Preventivo' : 'Correctivo'}
            </p>
          </div>
          <div className="bg-warning/10 rounded p-3 text-xs text-warning space-y-1">
            <p>• Creará la orden en estado PROGRAMADA</p>
            {tipo === 'correctivo' && (
              <p>• La impresora cambiará a estado EN MANTENIMIENTO</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowConfirm(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>Crear Orden</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showSuccess}
        onClose={handleSuccessClose}
        title="Orden Creada Exitosamente"
      >
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <Check className="h-8 w-8 text-success" />
            </div>
          </div>
          <div>
            <p className="font-medium">Orden #{createdOrderId} creada</p>
            <p className="text-sm text-muted-foreground">
              {selectedPrinter ? `${selectedPrinter.marca} ${selectedPrinter.modelo} — ` : ''}
              {tipo === 'preventivo' ? 'Mantenimiento preventivo' : 'Mantenimiento correctivo'}
            </p>
          </div>
          <div className="flex justify-center gap-3">
            <Button variant="secondary" onClick={handleSuccessClose}>
              Cerrar
            </Button>
            <Button
              onClick={() => {
                setShowSuccess(false)
                if (createdOrderId) navigate(`/inventario/mantenimiento/${createdOrderId}`)
              }}
            >
              Ver orden
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}
