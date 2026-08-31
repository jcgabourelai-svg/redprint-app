import { useNavigate } from 'react-router-dom'
import type { Visit } from '../types/api'
import { daysOverdueLabel, formatDateLong } from '../lib/format'
import { Badge, estadoVisitaTone, tipoVisitaIcon, tipoVisitaTone } from './ui'

export default function VisitCard({ visit }: { visit: Visit }) {
  const navigate = useNavigate()
  const printerCount = visit.impresoras?.length ?? 0
  const overdueLabel =
    visit.fecha_programada &&
    (visit.estado === 'PENDIENTE' || visit.estado === 'REPROGRAMADA')
      ? daysOverdueLabel(visit.fecha_programada)
      : null

  return (
    <button
      onClick={() => navigate(`/visita/${visit.id}`)}
      className={`mb-3 w-full rounded-xl border border-gray-200 bg-white p-3.5 text-left shadow-sm active:bg-gray-50 ${
        overdueLabel ? 'border-l-4 border-l-red-500' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-800">
            {visit.cliente_nombre ?? `Cliente #${visit.cliente_id}`}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {formatDateLong(visit.fecha_programada)}
            {printerCount > 0 && (
              <span className="text-gray-400">
                {' · '}🖨️ {printerCount} {printerCount === 1 ? 'impresora' : 'impresoras'}
              </span>
            )}
          </p>
        </div>
        <span className="text-xl leading-none">
          {tipoVisitaIcon[visit.tipo_visita ?? ''] ?? '📋'}
        </span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {visit.tipo_visita && (
          <Badge tone={tipoVisitaTone[visit.tipo_visita]}>{visit.tipo_visita}</Badge>
        )}
        {overdueLabel ? (
          <Badge tone="red">Vencida · {overdueLabel}</Badge>
        ) : (
          visit.estado && <Badge tone={estadoVisitaTone[visit.estado]}>{visit.estado}</Badge>
        )}
        {visit.origen === 'CAMPO' && <Badge tone="blue">Campo</Badge>}
      </div>
    </button>
  )
}
