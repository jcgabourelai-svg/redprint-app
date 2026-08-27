import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useDiscardFieldRecord } from '@/hooks/useFieldRecords'
import { parseApiError } from '@/lib/api-errors'
import type { FieldRecord } from '@/types/field-record'

interface DiscardFieldRecordModalProps {
  record: FieldRecord | null
  isOpen: boolean
  onClose: () => void
  onSuccess: (mensaje: string) => void
  onError: (mensaje: string) => void
}

export default function DiscardFieldRecordModal({
  record,
  isOpen,
  onClose,
  onSuccess,
  onError,
}: DiscardFieldRecordModalProps) {
  const [motivo, setMotivo] = useState('')
  const discardMutation = useDiscardFieldRecord()

  useEffect(() => {
    if (isOpen) setMotivo('')
  }, [isOpen])

  if (!record) return null

  const puedeEnviar = motivo.trim().length >= 5 && !discardMutation.isPending

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Descartar registro #${record.id}`} size="md">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          El registro de <strong>{record.nombre_cliente_reportado}</strong> quedará marcado como{' '}
          <strong>descartado</strong> de forma permanente. No se crea ninguna visita ni movimiento;
          la evidencia (foto, fecha, GPS) se conserva como histórico. Esta acción no se puede
          deshacer.
        </p>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Motivo del descarte *
          </label>
          <textarea
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="¿Por qué se descarta este registro? (duplicado, captura equivocada, fuera de alcance…)"
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={discardMutation.isPending}>
            No, volver
          </Button>
          <Button
            variant="danger"
            onClick={() =>
              discardMutation.mutate(
                { id: record.id, motivo: motivo.trim() },
                {
                  onSuccess: () => {
                    onSuccess(`Registro #${record.id} descartado.`)
                    onClose()
                  },
                  onError: (err) => onError(parseApiError(err)),
                }
              )
            }
            loading={discardMutation.isPending}
            disabled={!puedeEnviar}
          >
            Sí, descartar registro
          </Button>
        </div>
      </div>
    </Modal>
  )
}
