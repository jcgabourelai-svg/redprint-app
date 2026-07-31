import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { useCfdiDetail } from '@/hooks/useCfdi'
import { formatCurrency, formatDateTime } from '@/lib/formatters'
import { TipoComprobanteLabels } from '@/types/enums'
import { EstadoConciliacionBadge, EstadoClienteBadge } from '@/components/cfdi/EstadoBadges'

interface CfdiDetailModalProps {
  id: number | null
  isOpen: boolean
  onClose: () => void
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground break-all">{value || '-'}</span>
    </div>
  )
}

export default function CfdiDetailModal({ id, isOpen, onClose }: CfdiDetailModalProps) {
  const { data: cfdi, isLoading } = useCfdiDetail(id ?? undefined)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalle del comprobante" size="xl">
      {isLoading || !cfdi ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Cargando...</div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{cfdi.version}</Badge>
            <Badge variant="primary">{TipoComprobanteLabels[cfdi.tipo_comprobante]}</Badge>
            <EstadoConciliacionBadge estado={cfdi.estado_conciliacion} />
            <EstadoClienteBadge estado={cfdi.estado_cliente} />
          </div>

          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Folio fiscal (UUID)</p>
            <p className="text-sm font-mono break-all">{cfdi.uuid}</p>
            {cfdi.serie_folio && (
              <p className="text-sm mt-1">Serie-Folio: <strong>{cfdi.serie_folio}</strong></p>
            )}
            <p className="text-sm mt-1">Emision: {formatDateTime(cfdi.fecha_emision)}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">Emisor</h4>
              <Row label="RFC" value={cfdi.rfc_emisor} />
              <Row label="Nombre" value={cfdi.nombre_emisor} />
              <Row label="Regimen fiscal" value={cfdi.regimen_fiscal_emisor} />
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">Receptor</h4>
              <Row label="RFC" value={cfdi.rfc_receptor} />
              <Row label="Nombre" value={cfdi.nombre_receptor} />
              <Row label="Uso CFDI" value={cfdi.uso_cfdi} />
              <Row label="Cliente asignado" value={cfdi.receptor?.razon_social ?? 'Sin asignar'} />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Row label="Subtotal" value={formatCurrency(cfdi.subtotal)} />
            <Row label="Descuento" value={cfdi.descuento ? formatCurrency(cfdi.descuento) : '-'} />
            <Row label="IVA trasladado" value={cfdi.iva_trasladado ? formatCurrency(cfdi.iva_trasladado) : '-'} />
            <Row label="Total" value={<strong>{formatCurrency(cfdi.total)}</strong>} />
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Conceptos</h4>
            {cfdi.conceptos && cfdi.conceptos.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Descripcion</th>
                      <th className="px-3 py-2 text-right">Cantidad</th>
                      <th className="px-3 py-2 text-right">P. unitario</th>
                      <th className="px-3 py-2 text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {cfdi.conceptos.map((c) => (
                      <tr key={c.id}>
                        <td className="px-3 py-2">{c.descripcion}</td>
                        <td className="px-3 py-2 text-right">{Number(c.cantidad)}</td>
                        <td className="px-3 py-2 text-right">
                          {c.valor_unitario != null ? formatCurrency(c.valor_unitario) : '-'}
                        </td>
                        <td className="px-3 py-2 text-right">{formatCurrency(c.importe)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin conceptos.</p>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
