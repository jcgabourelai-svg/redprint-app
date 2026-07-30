import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Gauge,
  Printer as PrinterIcon,
  Calendar,
  User as UserIcon,
  AlertTriangle,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { useReading } from '@/hooks/useReadings'
import { formatDate } from '@/lib/formatters'
import { parseApiError } from '@/lib/api-errors'

export default function ReadingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const idNum = parseInt(id || '0')

  const { data: reading, isLoading, error } = useReading(idNum)

  if (!idNum) {
    return (
      <PageLayout title="Lectura no encontrada">
        <div className="text-center py-12">
          <p className="text-muted-foreground">ID de lectura inválido</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate('/operaciones/lecturas')}>
            Volver a lecturas
          </Button>
        </div>
      </PageLayout>
    )
  }

  if (isLoading) {
    return (
      <PageLayout title="Cargando lectura...">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Cargando información de la lectura...</p>
        </div>
      </PageLayout>
    )
  }

  if (error || !reading) {
    return (
      <PageLayout title="Lectura no encontrada">
        <div className="text-center py-12">
          <p className="text-destructive">{parseApiError(error)}</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate('/operaciones/lecturas')}>
            Volver a lecturas
          </Button>
        </div>
      </PageLayout>
    )
  }

  const printer = reading.printer as Record<string, unknown> | undefined
  const lecturaAnterior = reading.lectura_anterior ?? 0
  const lecturaActual = reading.lectura_actual ?? 0
  const paginas = reading.paginas_consumidas ?? reading.paginas_periodo ?? 0
  const anomala = !!reading.excepcion || !!reading.es_anomalia

  return (
    <PageLayout title="Operaciones › Lecturas">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Detalle de lectura</h2>
            <p className="text-sm text-muted-foreground">
              Lectura #{reading.id} · {formatDate(reading.fecha)}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/operaciones/lecturas')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase text-muted-foreground">Contador anterior</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold tabular-nums text-foreground">
                  {lecturaAnterior.toLocaleString('es-MX')}
                </span>
                <span className="text-sm text-muted-foreground">hojas</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase text-muted-foreground">Contador actual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-success" />
                <span className="text-2xl font-bold tabular-nums text-success">
                  {lecturaActual.toLocaleString('es-MX')}
                </span>
                <span className="text-sm text-muted-foreground">hojas</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase text-muted-foreground">Páginas consumidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold tabular-nums text-foreground">
                  {paginas.toLocaleString('es-MX')}
                </span>
                <span className="text-sm text-muted-foreground">hojas</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase text-muted-foreground">Información de la lectura</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Fecha:</span>
                <span className="font-medium">{formatDate(reading.fecha)}</span>
              </div>
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Socio capturista:</span>
                <span className="font-medium">{reading.socio_capturista || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <PrinterIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Impresora:</span>
                <span className="font-medium">{reading.impresora_nombre || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Estado:</span>
                <Badge variant={anomala ? 'error' : 'success'}>
                  {anomala ? 'Anómala' : 'Normal'}
                </Badge>
              </div>
            </div>

            {printer && (
              <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Marca / Modelo:</span>{' '}
                  <span className="font-medium">{String(printer.marca ?? '-')} {String(printer.modelo ?? '')}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Número de serie:</span>{' '}
                  <span className="font-medium">{String(printer.num_serie ?? printer.numero_serie ?? '-')}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {anomala && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" /> Anomalía detectada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground">
                {reading.justificacion_anomalia || reading.excepcion || 'Lectura marcada como anómala.'}
              </p>
            </CardContent>
          </Card>
        )}

        {reading.evidencia_foto && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase text-muted-foreground flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" /> Evidencia fotográfica
              </CardTitle>
            </CardHeader>
            <CardContent>
              <img
                src={reading.evidencia_foto}
                alt="Evidencia de la lectura"
                className="max-h-80 rounded-lg border border-border object-contain"
              />
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => navigate(`/operaciones/visitas/${reading.visita_id}`)}
          >
            <ExternalLink className="h-4 w-4 mr-1" /> Ver visita relacionada
          </Button>
        </div>
      </div>
    </PageLayout>
  )
}
