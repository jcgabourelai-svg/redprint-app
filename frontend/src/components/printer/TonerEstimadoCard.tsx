import { Droplet } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import TonerLevelsChips from '@/components/ui/TonerLevelsChips'
import { usePrinterToner } from '@/hooks/useToner'
import { formatDate } from '@/lib/formatters'
import type { TonerColor } from '@/types/api'

const NOMBRE_COLOR: Record<string, string> = {
  k: 'Negro',
  c: 'Cian',
  m: 'Magenta',
  y: 'Amarillo',
}

/**
 * Card "Tóner (estimado)" del detalle de impresora: niveles actuales,
 * páginas/días restantes por color, último cambio detectado (con
 * correlación de entrega) y rendimiento real del modelo. Degrada limpio
 * con datos insuficientes: todo lo toner-related lee "estimado".
 */
export default function TonerEstimadoCard({ printerId }: { printerId: number }) {
  const { data, isLoading } = usePrinterToner(printerId)

  const niveles = data?.niveles_actuales ?? null
  const porColor = data?.por_color ?? {}
  const colores = Object.keys(porColor) as TonerColor[]
  const cambio = data?.cambios?.[0]
  const hayDatos = (niveles && Object.keys(niveles).length > 0) || colores.length > 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Droplet className="h-5 w-5 text-primary" />
          <CardTitle>Tóner (estimado)</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Calculando estimados…</p>
        ) : !hayDatos ? (
          <p className="text-sm text-muted-foreground">
            Capturá niveles en las próximas lecturas para ver estimados.
          </p>
        ) : (
          <>
            {niveles && Object.keys(niveles).length > 0 && (
              <div className="space-y-1.5">
                <TonerLevelsChips levels={niveles} />
                {data?.fecha_ultimo_nivel && (
                  <p className="text-xs text-muted-foreground">
                    Último nivel capturado: {formatDate(data.fecha_ultimo_nivel)}
                  </p>
                )}
              </div>
            )}

            {colores.length > 0 && (
              <div className="space-y-1.5">
                {colores.map((color) => {
                  const est = porColor[color]
                  if (!est) return null
                  return (
                    <div key={color} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {NOMBRE_COLOR[color] ?? color.toUpperCase()}
                      </span>
                      <span className="tabular-nums text-foreground">
                        {est.paginas_restantes != null
                          ? `~${est.paginas_restantes.toLocaleString('es-MX')} págs${
                              est.dias != null ? ` / ~${est.dias} días` : ''
                            }`
                          : 'Sin datos suficientes'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {data?.rendimiento_real_modelo != null && (
              <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                Rendimiento real del modelo: ~
                {data.rendimiento_real_modelo.toLocaleString('es-MX')} páginas por
                tóner (mediana estimada)
              </p>
            )}

            {cambio && (
              <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                Último cambio detectado: {formatDate(cambio.fecha)} (
                {(cambio.color || '?').toUpperCase()} {cambio.nivel_antes}% →{' '}
                {cambio.nivel_despues}%).{' '}
                {cambio.con_entrega
                  ? `Coincide con la entrega de ${cambio.entrega_articulo ?? 'tóner'}${
                      cambio.entrega_fecha ? ` (${formatDate(cambio.entrega_fecha)})` : ''
                    }.`
                  : 'Sin entrega de tóner registrada cerca (posible cambio por cuenta propia).'}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
