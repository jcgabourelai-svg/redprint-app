import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/formatters'
import TonerLevelsChips from '@/components/ui/TonerLevelsChips'
import { useTonerPanel } from '@/hooks/useToner'

/**
 * Widget "Tóner bajo (estimado)": impresoras rentadas con nivel bajo o
 * próximos a agotarse, cruzadas con la próxima visita del contrato
 * ("llevá tóner" vs "se agota antes"). Hace fetch propio; el dashboard
 * lo renderiza solo si el usuario tiene operaciones.lecturas.
 */
export default function TonerBajoWidget() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useTonerPanel()
  const impresoras = data?.impresoras ?? []

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="font-semibold text-foreground">Tóner bajo (estimado)</h3>
          <p className="text-xs text-muted-foreground">
            {isLoading
              ? 'Cargando…'
              : `${impresoras.length} impresora(s) con tóner bajo o próximo a agotarse`}
          </p>
        </div>
      </div>

      {error ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          No se pudo cargar el estado de tóner.
        </p>
      ) : impresoras.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          Sin impresoras con tóner bajo.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {impresoras.map((item) => (
            <button
              key={item.impresora_id}
              type="button"
              onClick={() => navigate(`/inventario/impresoras/${item.impresora_id}`)}
              className="block w-full px-4 py-3 text-left hover:bg-muted"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.marca} {item.modelo}
                    {item.alias ? ` (${item.alias})` : ''}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.cliente_nombre ?? 'Sin cliente'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="whitespace-nowrap text-sm font-semibold text-foreground">
                    {item.dias_para_agotarse != null
                      ? `~${item.dias_para_agotarse} días`
                      : item.paginas_restantes != null
                        ? `~${item.paginas_restantes.toLocaleString('es-MX')} págs`
                        : `${item.nivel_critico ?? '?'}% sin estimado`}
                  </p>
                  {item.paginas_restantes != null && item.dias_para_agotarse != null && (
                    <p className="whitespace-nowrap text-xs text-muted-foreground">
                      ~{item.paginas_restantes.toLocaleString('es-MX')} págs
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <TonerLevelsChips levels={item.niveles} />
                {item.proxima_visita_fecha && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-xs',
                      item.urgente_antes_de_visita
                        ? 'font-medium text-destructive'
                        : 'text-muted-foreground'
                    )}
                  >
                    {item.urgente_antes_de_visita ? (
                      <AlertTriangle className="h-3 w-3" />
                    ) : (
                      <CalendarClock className="h-3 w-3" />
                    )}
                    {item.urgente_antes_de_visita
                      ? `Se agota antes de la visita del ${formatDate(item.proxima_visita_fecha)}`
                      : `Visita: ${formatDate(item.proxima_visita_fecha)} — llevá tóner`}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
