import { Link } from 'react-router-dom'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { FieldRecordEstadoBadge, FieldRecordTipoBadge } from '@/components/fieldrecords/FieldRecordBadges'
import { FieldRecordStatusLabels } from '@/types/enums'
import { formatDateTime } from '@/lib/formatters'
import type { FieldRecord } from '@/types/field-record'

interface FieldRecordDetailModalProps {
  record: FieldRecord | null
  isOpen: boolean
  onClose: () => void
  onVincular: (record: FieldRecord) => void
  onDescartar: (record: FieldRecord) => void
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground break-all">{value || '-'}</span>
    </div>
  )
}

export default function FieldRecordDetailModal({
  record,
  isOpen,
  onClose,
  onVincular,
  onDescartar,
}: FieldRecordDetailModalProps) {
  if (!record) return null

  const esPendiente = record.estado === 'PENDIENTE'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Registro de campo #${record.id}`} size="lg">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <FieldRecordTipoBadge tipo={record.tipo} />
          <FieldRecordEstadoBadge estado={record.estado} />
          <span className="text-xs text-muted-foreground">
            Capturado el {formatDateTime(record.capturado_en)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Row label="Cliente reportado" value={record.nombre_cliente_reportado} />
          <Row label="Dirección reportada" value={record.direccion_reportada} />
          <Row label="Marca reportada" value={record.marca_reportada} />
          <Row label="Modelo reportado" value={record.modelo_reportada} />
          <Row label="N° de serie reportado" value={record.num_serie_reportado} />
          <Row
            label="Contador capturado"
            value={
              record.valor_contador != null
                ? Number(record.valor_contador).toLocaleString('es-MX')
                : '-'
            }
          />
          <Row label="Socio (capturó en campo)" value={record.socio_nombre ?? `#${record.socio_id}`} />
          <Row
            label="Ubicación"
            value={
              record.ubicacion_lat != null && record.ubicacion_lng != null
                ? `${Number(record.ubicacion_lat).toFixed(5)}, ${Number(record.ubicacion_lng).toFixed(5)}`
                : '-'
            }
          />
        </div>

        {record.articulos_entregados && record.articulos_entregados.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              Artículos entregados (reporte del operador)
            </h4>
            <ul className="text-sm space-y-1">
              {record.articulos_entregados.map((a, i) => (
                <li key={i} className="rounded-md border border-border bg-muted/40 px-3 py-1.5">
                  {a.descripcion} <span className="text-muted-foreground">× {a.cantidad}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {record.notas && (
          <Row label="Notas" value={<span className="whitespace-pre-line">{record.notas}</span>} />
        )}

        {record.foto_evidencia && (
          <div>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Evidencia fotográfica</h4>
            <img
              src={record.foto_evidencia}
              alt={`Evidencia del registro #${record.id}`}
              className="max-h-64 rounded-lg border border-border object-contain"
            />
          </div>
        )}

        {!esPendiente && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Regularización</p>
            {record.estado === 'VINCULADO' && (
              <div className="text-sm space-y-1">
                <p>Vinculado el {record.vinculado_en ? formatDateTime(record.vinculado_en) : '-'} por {record.vinculado_por ?? '-'}</p>
                {record.cliente_id && (
                  <p>
                    Cliente:{' '}
                    {record.client ? (
                      <Link to={`/clientes/${record.client.id}`} className="text-primary hover:underline">
                        {record.client.razon_social}
                      </Link>
                    ) : (
                      `#${record.cliente_id}`
                    )}
                  </p>
                )}
                {record.contrato_id && (
                  <p>
                    Contrato:{' '}
                    <Link to={`/contratos/${record.contrato_id}`} className="text-primary hover:underline">
                      #{record.contrato_id}
                    </Link>
                  </p>
                )}
                {record.visita_id && (
                  <p>
                    Visita:{' '}
                    <Link to={`/operaciones/visitas/${record.visita_id}`} className="text-primary hover:underline">
                      #{record.visita_id}
                    </Link>
                    {record.lectura_id && <> · Lectura #{record.lectura_id}</>}
                  </p>
                )}
              </div>
            )}
            {record.estado === 'DESCARTADO' && (
              <p className="text-sm">
                Descartado el {record.vinculado_en ? formatDateTime(record.vinculado_en) : '-'} por {record.vinculado_por ?? '-'}
                {record.motivo_descarte && (
                  <span className="block text-muted-foreground mt-1">Motivo: {record.motivo_descarte}</span>
                )}
              </p>
            )}
            <p className="text-xs text-muted-foreground pt-1 border-t border-border">
              Los registros {FieldRecordStatusLabels[record.estado].toLowerCase()}s son inmutables.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          {esPendiente && (
            <>
              <Button variant="danger" onClick={() => onDescartar(record)}>
                Descartar…
              </Button>
              <Button onClick={() => onVincular(record)}>
                Regularizar…
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
