import { useLocation, Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

const routeTranslations: Record<string, string> = {
  impresoras: 'Impresoras',
  almacenes: 'Almacenes',
  calendario: 'Calendario',
  lecturas: 'Lecturas',
  facturas: 'Facturas',
  pagos: 'Pagos',
  usuarios: 'Usuarios',
  notificaciones: 'Notificaciones',
  configuracion: 'Configuracion',
  nuevo: 'Nuevo',
  editar: 'Editar',
  detalle: 'Detalle',
}

function translateSegment(segment: string): string {
  if (routeTranslations[segment]) return routeTranslations[segment]
  if (/^\d+$/.test(segment)) return `#${segment}`
  return segment.charAt(0).toUpperCase() + segment.slice(1)
}

export default function Breadcrumbs() {
  const location = useLocation()
  const segments = location.pathname.split('/').filter(Boolean)

  if (segments.length === 0) return null

  const crumbs = segments.map((segment, index) => {
    const path = '/' + segments.slice(0, index + 1).join('/')
    const label = translateSegment(segment)
    const isLast = index === segments.length - 1

    return { path, label, isLast }
  })

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground py-3">
      <Link
        to="/"
        className="flex items-center hover:text-foreground transition-colors"
      >
        <Home className="h-4 w-4" />
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.path} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3" />
          {crumb.isLast ? (
            <span className="font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link
              to={crumb.path}
              className="hover:text-foreground transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
