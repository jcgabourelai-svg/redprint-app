import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Printer, Warehouse, Calendar, FileText, DollarSign, Users, Bell, Settings, ChevronDown, LayoutDashboard, Package, Wrench, ShoppingCart, BarChart3, Landmark, TrendingUp, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/enums'

interface SidebarSection {
  title: string
  items: { label: string; to: string; icon: React.ElementType }[]
}

const sections: SidebarSection[] = [
  {
    title: 'Inventario',
    items: [
      { label: 'Impresoras', to: '/impresoras', icon: Printer },
      { label: 'Almacenes', to: '/almacenes', icon: Warehouse },
      { label: 'Articulos', to: '/articulos', icon: Package },
      { label: 'Movimientos', to: '/inventario/movimientos', icon: FileText },
    ],
  },
  {
    title: 'Mantenimiento',
    items: [
      { label: 'Ordenes', to: '/mantenimiento', icon: Wrench },
      { label: 'Gastos', to: '/gastos/registrar', icon: DollarSign },
    ],
  },
  {
    title: 'Compras',
    items: [
      { label: 'Compras', to: '/compras', icon: ShoppingCart },
    ],
  },
  {
    title: 'Operaciones',
    items: [
      { label: 'Calendario', to: '/calendario', icon: Calendar },
      { label: 'Lecturas', to: '/lecturas', icon: FileText },
    ],
  },
  {
    title: 'Reportes',
    items: [
      { label: 'Proveedores', to: '/reportes/mantenimiento/proveedores', icon: BarChart3 },
      { label: 'Impresoras', to: '/reportes/mantenimiento/impresoras-problematicas', icon: Printer },
      { label: 'Costos', to: '/reportes/mantenimiento/costo-impresora', icon: DollarSign },
      { label: 'Rentabilidad', to: '/reportes/rentabilidad', icon: TrendingUp },
      { label: 'Flujo de Caja', to: '/reportes/flujo-caja', icon: BarChart3 },
    ],
  },
  {
    title: 'Finanzas',
    items: [
      { label: 'Facturas', to: '/facturas', icon: FileText },
      { label: 'Cuentas Bancarias', to: '/cuentas-bancarias', icon: Landmark },
      { label: 'Conciliacion', to: '/conciliacion', icon: DollarSign },
      { label: 'Cierre Periodo', to: '/cierre-periodo', icon: Lock },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { label: 'Usuarios', to: '/usuarios', icon: Users },
      { label: 'Notificaciones', to: '/notificaciones', icon: Bell },
      { label: 'Configuracion', to: '/configuracion', icon: Settings },
    ],
  },
]

interface SidebarProps {
  userRole?: UserRole
}

export default function Sidebar({ userRole }: SidebarProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggleSection = (title: string) => {
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }))
  }

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-border z-30">
      <div className="flex items-center gap-2 px-6 h-16 border-b border-border shrink-0">
        <LayoutDashboard className="h-7 w-7 text-primary" />
        <span className="text-lg font-bold text-primary">RedPrint</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors mb-1',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )
          }
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </NavLink>

        {sections.map((section) => (
          <div key={section.title} className="mt-3">
            <button
              type="button"
              onClick={() => toggleSection(section.title)}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              {section.title}
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform',
                  collapsed[section.title] && '-rotate-90',
                )}
              />
            </button>

            {!collapsed[section.title] && (
              <div className="mt-1 space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      )
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {userRole && (
        <div className="border-t border-border px-4 py-3 shrink-0">
          <p className="text-xs text-muted-foreground">Rol: {userRole}</p>
        </div>
      )}
    </aside>
  )
}
