import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Menu } from 'lucide-react'
import { navItems, filterVisibleNav, type NavItem } from '@/config/nav'
import { useAuth } from '@/contexts/AuthContext'

// Curated top-level sections shown in the bottom bar (rest reachable via "Mas").
const BOTTOM_NAV_IDS = ['dashboard', 'inventario', 'clientes', 'operaciones', 'finanzas']

export interface BottomNavProps {
  onMenuClick?: () => void
}

export default function BottomNav({ onMenuClick }: BottomNavProps) {
  const location = useLocation()
  const { user } = useAuth()

  const tienePermiso = (clave?: string) => {
    if (!clave) return true
    if (!user) return false
    if (user.es_sistema) return true
    return (user.permisos ?? []).includes(clave)
  }

  const filteredAll = filterVisibleNav(navItems, tienePermiso)
  const items: NavItem[] = BOTTOM_NAV_IDS.map((id) => filteredAll.find((i) => i.id === id)).filter((i): i is NavItem => !!i)

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border bg-card px-2 py-2 lg:hidden">
      {items.map((item) => {
        const Icon = item.icon
        const active = isActive(item.path)

        return (
          <Link
            key={item.id}
            to={item.path}
            className={cn(
              'flex flex-col items-center gap-1 rounded-md px-3 py-2 transition-colors',
              active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className={cn('h-6 w-6', active && 'fill-current')} />
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        )
      })}

      <button
        onClick={onMenuClick}
        className="flex flex-col items-center gap-1 rounded-md px-3 py-2 text-muted-foreground hover:text-foreground"
      >
        <Menu className="h-6 w-6" />
        <span className="text-xs font-medium">Más</span>
      </button>
    </nav>
  )
}
