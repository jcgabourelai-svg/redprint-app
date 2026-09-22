import { useState } from 'react'
import { Wrench, PackageOpen } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { useUpdatePrinterCondition, useExtractPrinterPart } from '@/hooks/usePrinters'
import { formatDate } from '@/lib/formatters'
import { printerConditionLabel } from '@/lib/printerCondition'
import { ConditionChip } from '@/lib/printerCondition'

const condicionOptions = [
  { value: 'OPERATIVA', label: 'Operativa' },
  { value: 'REQUIERE_ATENCION', label: 'Requiere atención' },
  { value: 'NO_OPERATIVA', label: 'No operativa' },
  { value: 'PIEZAS', label: 'Donante de piezas' },
]

interface Props {
  printer: any
  canEdit: boolean
}

export default function PrinterConditionCard({ printer, canEdit }: Props) {
  const updateCondition = useUpdatePrinterCondition()
  const extractPart = useExtractPrinterPart()

  const [showCondicionModal, setShowCondicionModal] = useState(false)
  const [nuevaCondicion, setNuevaCondicion] = useState(printer.condicion ?? 'OPERATIVA')
  const [condicionNota, setCondicionNota] = useState(printer.condicion_nota ?? '')
  const [condicionMotivo, setCondicionMotivo] = useState('')
  const [condicionError, setCondicionError] = useState('')

  const [showExtractModal, setShowExtractModal] = useState(false)
  const [extractNombre, setExtractNombre] = useState('')
  const [extractTipo, setExtractTipo] = useState('REPARACION')
  const [extractCantidad, setExtractCantidad] = useState('1')
  const [extractCosto, setExtractCosto] = useState('0')
  const [extractNumParte, setExtractNumParte] = useState('')
  const [extractError, setExtractError] = useState('')

  const openCondicionModal = () => {
    setNuevaCondicion(printer.condicion ?? 'OPERATIVA')
    setCondicionNota(printer.condicion_nota ?? '')
    setCondicionMotivo('')
    setCondicionError('')
    setShowCondicionModal(true)
  }

  const handleUpdateCondicion = () => {
    if (condicionMotivo.trim().length < 3) {
      setCondicionError('El motivo es obligatorio (mínimo 3 caracteres).')
      return
    }
    setCondicionError('')
    updateCondition.mutate(
      {
        id: printer.id,
        condicion: nuevaCondicion,
        condicion_nota: condicionNota.trim() || undefined,
        motivo: condicionMotivo.trim(),
      },
      {
        onSuccess: () => setShowCondicionModal(false),
        onError: (err: any) => {
          setCondicionError(err?.response?.data?.message || 'No se pudo actualizar la condición')
        },
      },
    )
  }

  const handleExtract = () => {
    if (extractNombre.trim().length < 3) {
      setExtractError('El nombre de la pieza es obligatorio (mínimo 3 caracteres).')
      return
    }
    const cantidad = parseInt(extractCantidad, 10)
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      setExtractError('La cantidad debe ser un entero mayor o igual a 1.')
      return
    }
    setExtractError('')
    extractPart.mutate(
      {
        id: printer.id,
        nombre_nuevo: extractNombre.trim(),
        tipo_articulo: extractTipo,
        cantidad,
        costo_unitario: parseFloat(extractCosto) || 0,
        num_parte: extractNumParte.trim() || undefined,
      },
      {
        onSuccess: () => {
          setShowExtractModal(false)
          setExtractNombre('')
          setExtractCantidad('1')
          setExtractCosto('0')
          setExtractNumParte('')
        },
        onError: (err: any) => {
          setExtractError(err?.response?.data?.message || 'No se pudo registrar la pieza extraída')
        },
      },
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              <CardTitle>Condición técnica</CardTitle>
            </div>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={openCondicionModal}>
                Cambiar condición
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            {printer.condicion ? (
              <ConditionChip condicion={printer.condicion} />
            ) : (
              <p className="text-sm text-muted-foreground">Sin condición</p>
            )}
            {printer.condicion_actualizada_en && (
              <p className="text-xs text-muted-foreground mt-2">
                Actualizada: {formatDate(printer.condicion_actualizada_en)}
              </p>
            )}
          </div>
          {printer.condicion_nota && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-1">Nota</p>
              <p className="text-sm text-foreground whitespace-pre-line">{printer.condicion_nota}</p>
            </div>
          )}
          {printer.condicion === 'PIEZAS' && canEdit && (
            <Button
              className="w-full mt-4"
              variant="outline"
              onClick={() => {
                setExtractError('')
                setShowExtractModal(true)
              }}
            >
              <PackageOpen className="mr-2 h-4 w-4" />
              Extraer pieza
            </Button>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={showCondicionModal} onClose={() => setShowCondicionModal(false)} title="Cambiar condición técnica">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Condición actual: <span className="font-medium text-foreground">{printerConditionLabel(printer.condicion)}</span>
          </p>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Nueva condición</label>
            <Select
              options={condicionOptions}
              value={nuevaCondicion}
              onChange={(v) => setNuevaCondicion(v)}
              placeholder="Condición"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Nota <span className="text-muted-foreground">(opcional)</span>
            </label>
            <textarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Ej: fusor desgastado, se atiende en próxima visita..."
              value={condicionNota}
              onChange={(e) => setCondicionNota(e.target.value)}
              disabled={updateCondition.isPending}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Motivo <span className="text-destructive">*</span>
            </label>
            <Input
              value={condicionMotivo}
              onChange={(e) => setCondicionMotivo(e.target.value)}
              placeholder="Motivo del cambio (obligatorio)"
              disabled={updateCondition.isPending}
            />
          </div>
          {condicionError && <p className="text-sm text-destructive">{condicionError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowCondicionModal(false)} disabled={updateCondition.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateCondicion} loading={updateCondition.isPending}>
              Guardar condición
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showExtractModal} onClose={() => setShowExtractModal(false)} title="Extraer pieza al inventario">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            La pieza ingresa al inventario con referencia <span className="font-medium text-foreground">DESHUESE</span> y
            queda registrada en el kardex de movimientos.
          </p>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Nombre de la pieza <span className="text-destructive">*</span>
            </label>
            <Input
              value={extractNombre}
              onChange={(e) => setExtractNombre(e.target.value)}
              placeholder="Ej: Fusor HP M404"
              disabled={extractPart.isPending}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Tipo</label>
              <Select
                options={[
                  { value: 'REPARACION', label: 'Reparación' },
                  { value: 'CONSUMIBLE', label: 'Consumible' },
                ]}
                value={extractTipo}
                onChange={(v) => setExtractTipo(v)}
                placeholder="Tipo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Cantidad</label>
              <Input
                type="number"
                min={1}
                value={extractCantidad}
                onChange={(e) => setExtractCantidad(e.target.value)}
                disabled={extractPart.isPending}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Costo unitario</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={extractCosto}
                onChange={(e) => setExtractCosto(e.target.value)}
                disabled={extractPart.isPending}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Núm. de parte <span className="text-muted-foreground">(opcional)</span>
              </label>
              <Input
                value={extractNumParte}
                onChange={(e) => setExtractNumParte(e.target.value)}
                placeholder="Ej. RM2-5399"
                disabled={extractPart.isPending}
              />
            </div>
          </div>
          {extractError && <p className="text-sm text-destructive">{extractError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowExtractModal(false)} disabled={extractPart.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleExtract} loading={extractPart.isPending}>
              Extraer pieza
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
