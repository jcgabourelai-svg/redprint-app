import { useNavigate } from 'react-router-dom'
import type { Visit } from '../types/api'
import { formatDateLong } from '../lib/format'
import { Badge, estadoVisitaTone, tipoVisitaIcon, tipoVisitaTone } from './ui'

export default function VisitCard({ visit }: { visit: Visit }) {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate(`/visita/${visit.id}`)}
      className="mb-3 w-full rounded-xl border border-gray-200 bg-white p-3.5 text-left shadow-sm active:bg-gray-50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-800">
            {visit.cliente_nombre ?? `Cliente #${visit.cliente_id}`}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">{formatDateLong(visit.fecha_programada)}</p>
        </div>
        <span className="text-xl leading-none">
          {tipoVisitaIcon[visit.tipo_visita ?? ''] ?? '📋'}
        </span>
      </div>
      <div className="mt-2.5 flex gap-1.5">
        {visit.tipo_visita && (
          <Badge tone={tipoVisitaTone[visit.tipo_visita]}>{visit.tipo_visita}</Badge>
        )}
        {visit.estado && <Badge tone={estadoVisitaTone[visit.estado]}>{visit.estado}</Badge>}
      </div>
    </button>
  )
}
