import Badge from '@/components/ui/Badge'
import {
  EstadoConciliacion,
  EstadoConciliacionLabels,
  EstadoCliente,
  EstadoClienteLabels,
} from '@/types/enums'

export function EstadoConciliacionBadge({ estado }: { estado: EstadoConciliacion }) {
  return (
    <Badge variant={estado === 'conciliado' ? 'success' : 'warning'}>
      {EstadoConciliacionLabels[estado]}
    </Badge>
  )
}

export function EstadoClienteBadge({ estado }: { estado: EstadoCliente }) {
  return (
    <Badge variant={estado === 'asignado' ? 'success' : 'warning'}>
      {EstadoClienteLabels[estado]}
    </Badge>
  )
}
