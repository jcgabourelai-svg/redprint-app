import Badge from '@/components/ui/Badge'
import {
  FieldRecordStatus,
  FieldRecordStatusLabels,
  FieldRecordType,
  FieldRecordTypeLabels,
} from '@/types/enums'

export function FieldRecordEstadoBadge({ estado }: { estado: FieldRecordStatus }) {
  const variant = estado === 'PENDIENTE' ? 'warning' : estado === 'VINCULADO' ? 'success' : 'neutral'
  return <Badge variant={variant}>{FieldRecordStatusLabels[estado]}</Badge>
}

export function FieldRecordTipoBadge({ tipo }: { tipo: FieldRecordType }) {
  const variant = tipo === 'LECTURA' ? 'info' : tipo === 'ENTREGA_INSUMOS' ? 'primary' : 'neutral'
  return <Badge variant={variant}>{FieldRecordTypeLabels[tipo]}</Badge>
}
