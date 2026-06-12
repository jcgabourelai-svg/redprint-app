import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  Calendar,
  DollarSign,
  Settings,
  X,
  ChevronDown,
  User,
  ShoppingCart,
  BarChart3,
  TrendingUp,
  CreditCard,
  FileSearch,
  Bell,
  ArrowLeftRight,
} from 'lucide-react'

export interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  path: string
  badge?: number
  children?: NavItem[]
}

const navItems: NavItem[] = [
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
    children: [
      { id: 'impresoras', label: 'Impresoras', icon: Package, path: '/inventario/impresoras' },
      { id: 'articulos', label: 'Artículos', icon: Package, path: '/inventario/articulos' },
      { id: 'mantenimiento', label: 'Mantenimiento', icon: Settings, path: '/inventario/mantenimiento' },
      { id: 'almacenes', label: 'Almacenes', icon: Package, path: '/inventario/almacenes' },
      { id: 'movimientos', label: 'Movimientos', icon: ArrowLeftRight, path: '/inventario/movimientos' },
    ],
  },
  {
    id: 'clientes',
    label: 'Clientes',
    icon: Users,
    path: '/clientes',
  },
  {
    id: 'contratos',
    label: 'Contratos',
    icon: FileText,
    path: '/contratos',
  },
  {
    id: 'operaciones',
    label: 'Operaciones',
    icon: Calendar,
    path: '/operaciones',
    children: [
      { id: 'calendario', label: 'Calendario', icon: Calendar, path: '/operaciones/calendario' },
      { id: 'lecturas', label: 'Lecturas', icon: FileText, path: '/operaciones/lecturas' },
    ],
  },
  {
    id: 'finanzas',
    label: 'Finanzas',
    icon: DollarSign,
    path: '/finanzas',
    children: [
      { id: 'facturas', label: 'Facturas', icon: FileText, path: '/finanzas/facturas' },
      { id: 'cuentas-por-cobrar', label: 'Cuentas por Cobrar', icon: CreditCard, path: '/finanzas/cuentas-por-cobrar' },
      { id: 'cuentas-por-pagar', label: 'Cuentas por Pagar', icon: DollarSign, path: '/finanzas/cuentas-por-pagar' },
      { id: 'compras', label: 'Compras', icon: ShoppingCart, path: '/finanzas/compras' },
      { id: 'rentabilidad', label: 'Rentabilidad', icon: BarChart3, path: '/finanzas/rentabilidad' },
      { id: 'flujo-caja', label: 'Flujo de Caja', icon: TrendingUp, path: '/finanzas/flujo-caja' },
      { id: 'cuentas-bancarias', label: 'Cuentas Bancarias', icon: CreditCard, path: '/finanzas/cuentas-bancarias' },
      { id: 'conciliacion', label: 'Conciliación', icon: FileSearch, path: '/finanzas/conciliacion' },
      { id: 'cierre', label: 'Cierre de Periodo', icon: Calendar, path: '/finanzas/cierre' },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    icon: Settings,
    path: '/sistema',
    children: [
      { id: 'usuarios', label: 'Usuarios', icon: Users, path: '/sistema/usuarios' },
      { id: 'notificaciones', label: 'Notificaciones', icon: Bell, path: '/sistema/notificaciones' },
      { id: 'configuracion', label: 'Configuración', icon: Settings, path: '/sistema/configuracion' },
    ],
  },
]

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const toggleExpand = (itemId: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  return (
    <>
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-full w-64 bg-white border-r border-gray-200 transition-transform duration-300 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-500">
              <Package className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">RedPrint</span>
          </div>
          <button
            onClick={onToggle}
            className="rounded-md p-2 hover:bg-gray-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {navItems.map((item) => {
              const Icon = item.icon
              const hasChildren = item.children && item.children.length > 0
              const isExpanded = expandedItems.has(item.id)
              const active = isActive(item.path)

              return (
                <li key={item.id}>
                  {hasChildren ? (
                    <button
                      onClick={() => toggleExpand(item.id)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5" />
                        <span>{item.label}</span>
                        {item.badge && (
                          <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <ChevronDown
                        className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')}
                      />
                    </button>
                  ) : (
                    <Link
                      to={item.path}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  )}

                  {hasChildren && isExpanded && (
                    <ul className="ml-6 mt-1 space-y-1">
                      {item.children?.map((child) => (
                        <li key={child.id}>
                          <Link
                            to={child.path}
                            className={cn(
                              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                              isActive(child.path)
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-gray-700 hover:bg-gray-100'
                            )}
                          >
                            <child.icon className="h-4 w-4" />
                            <span>{child.label}</span>
                            {child.badge && (
                              <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white">
                                {child.badge}
                              </span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
              <User className="h-5 w-5 text-gray-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Juan Pérez</p>
              <p className="text-xs text-gray-500">Administrador</p>
            </div>
            <button
              className="rounded-md p-2 hover:bg-gray-100"
              onClick={() => navigate('/sistema/configuracion')}
              title="Configuración del sistema"
            >
              <Settings className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
