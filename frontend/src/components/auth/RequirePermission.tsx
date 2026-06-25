import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface RequirePermissionProps {
  permiso?: string
  children: ReactNode
}

/**
 * Guard de ruta por permiso. Si el usuario no cumple, redirige al dashboard.
 * Dashboard y login (sin `permiso`) quedan fuera de este guard.
 */
export default function RequirePermission({ permiso, children }: RequirePermissionProps) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  if (!permiso) {
    return <>{children}</>
  }

  const cumple = user?.es_sistema || (user?.permisos ?? []).includes(permiso)

  if (!cumple) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
