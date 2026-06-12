import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
  Users,
  Calendar,
  DollarSign,
  Menu,
} from 'lucide-react'

const navItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/',
  },
  {
    id: 'inventario',
    label: 'Inventario',
    icon: Package,
    path: '/inventario',
  },
  {
    id: 'clientes',
    label: 'Clientes',
    icon: Users,
    path: '/clientes',
  },
  {
    id: 'operaciones',
    label: 'Operaciones',
    icon: Calendar,
    path: '/operaciones',
  },
  {
    id: 'finanzas',
    label: 'Finanzas',
    icon: DollarSign,
    path: '/finanzas',
  },
]

export interface BottomNavProps {
  onMenuClick?: () => void
}

export default function BottomNav({ onMenuClick }: BottomNavProps) {
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-gray-200 bg-white px-2 py-2 lg:hidden">
      {navItems.map((item) => {
        const Icon = item.icon
        const active = isActive(item.path)

        return (
          <Link
            key={item.id}
            to={item.path}
            className={cn(
              'flex flex-col items-center gap-1 rounded-md px-3 py-2 transition-colors',
              active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <Icon className={cn('h-6 w-6', active && 'fill-current')} />
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        )
      })}

      <button
        onClick={onMenuClick}
        className="flex flex-col items-center gap-1 rounded-md px-3 py-2 text-gray-500 hover:text-gray-700"
      >
        <Menu className="h-6 w-6" />
        <span className="text-xs font-medium">Más</span>
      </button>
    </nav>
  )
}
