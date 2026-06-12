import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { Card, CardContent } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { useCreateMaintenanceOrder } from '@/hooks/useMaintenanceOrders'
import { usePrinters } from '@/hooks/usePrinters'
import { parseApiError } from '@/lib/api-errors'

export default function CreateMaintenanceOrder() {
  const navigate = useNavigate()
  const [showConfirm, setShowConfirm] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState('')

  const { data: printersData } = usePrinters({ per_page: 100 })
  const createMutation = useCreateMaintenanceOrder()

  const printers = printersData?.data || []
  const printerOptions = printers.map((p: any) => ({
    value: p.id,
    label: `${p.marca} ${p.modelo} (${p.id})`,
  }))

  const tipoOptions = [
    { value: 'preventivo', label: 'Preventivo' },
    { value: 'correctivo', label: 'Correctivo' },
  ]

  const socioOptions = [
    { value: 'María López', label: 'María López' },
    { value: 'Juan Pérez', label: 'Juan Pérez' },
    { value: 'Carlos Gómez', label: 'Carlos Gómez' },
    { value: 'Ana Ruiz', label: 'Ana Ruiz' },
  ]

  const [impresoraId, setImpresoraId] = useState('')
  const [tipo, setTipo] = useState<'preventivo' | 'correctivo'>('preventivo')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [descripcion, setDescripcion] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [costoManoObra, setCostoManoObra] = useState('')
  const [socioResponsable, setSocioResponsable] = useState('')

  const selectedPrinter = printerOptions.find((p) => p.value === impresoraId)

  const canSubmit =
    !!impresoraId && !!fecha && !!descripcion && !!socioResponsable

  const handleSubmit = async () => {
    setShowConfirm(false)
    setError('')
    try {
      const result = await createMutation.mutateAsync({
        impresora_id: parseInt(impresoraId),
        tipo,
        fecha,
        descripcion,
        proveedor: proveedor || undefined,
        costo_mano_obra: costoManoObra ? parseFloat(costoManoObra) : 0,
        socio_responsable: socioResponsable,
      })
      setShowSuccess(true)
    } catch (err) {
      setError(parseApiError(err))
    }
  }

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
              <div className="mb-4 p-3 text-sm text-red-700 bg-red-50 rounded-md">
                {error}
              </div>
            )}
            <h3 className="text-lg font-semibold text-gray-900 mb-6">
              Nueva Orden de Mantenimiento
            </h3>

            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Impresora *
                </label>
                <Select
                  options={printerOptions}
                  value={impresoraId}
                  onChange={setImpresoraId}
                  placeholder="Seleccionar impresora..."
                  searchable
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Servicio *
                </label>
                <Select
                  options={tipoOptions}
                  value={tipo}
                  onChange={(v) => setTipo(v as 'preventivo' | 'correctivo')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Programada *
                </label>
                <Input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción del Servicio *
                </label>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Describe el servicio de mantenimiento..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proveedor / Taller
                </label>
                <Input
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                  placeholder="Nombre del proveedor..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Socio Responsable *
                </label>
                <Select
                  options={socioOptions}
                  value={socioResponsable}
                  onChange={setSocioResponsable}
                  placeholder="Seleccionar socio..."
                />
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
          <p className="text-sm text-gray-600">
            ¿Estás seguro de que deseas crear esta orden de mantenimiento?
          </p>
          <div className="text-sm space-y-1">
            <p>
              <span className="text-gray-500">Impresora:</span>{' '}
              {selectedPrinter?.label}
            </p>
            <p>
              <span className="text-gray-500">Tipo:</span>{' '}
              {tipo === 'preventivo' ? 'Preventivo' : 'Correctivo'}
            </p>
            <p>
              <span className="text-gray-500">Responsable:</span>{' '}
              {socioResponsable}
            </p>
          </div>
          <div className="bg-amber-50 rounded p-3 text-xs text-amber-700 space-y-1">
            <p>• Creará la orden en estado PENDIENTE</p>
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
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <Check className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <div>
            <p className="font-medium">OM-006 creada</p>
            <p className="text-sm text-gray-500">
              {selectedPrinter?.label} —{' '}
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
                navigate('/inventario/mantenimiento/OM-006')
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
