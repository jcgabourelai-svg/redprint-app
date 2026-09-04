import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  Calendar,
  DollarSign,
  Settings,
  ChevronDown,
  ShoppingCart,
  BarChart3,
  TrendingUp,
  CreditCard,
  FileSearch,
  Bell,
  ArrowLeftRight,
  FileCheck2,
  HelpCircle,
  ClipboardList,
} from 'lucide-react'

export interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  path: string
  badge?: number
  /** Clave de permiso (config/permisos.php). Ausente => siempre visible (ej. Dashboard). */
  permiso?: string
  children?: NavItem[]
}

/**
 * Catalogo de navegacion compartido por Sidebar y BottomNav.
 * El campo `permiso` mapea cada hoja a una clave del catalogo de permisos.
 * Un padre se muestra si tiene al menos una hoja visible.
 */
export const navItems: NavItem[] = [
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
      { id: 'impresoras', label: 'Impresoras', icon: Package, path: '/inventario/impresoras', permiso: 'inventario.impresoras' },
      { id: 'articulos', label: 'Artículos', icon: Package, path: '/inventario/articulos', permiso: 'inventario.articulos' },
      { id: 'mantenimiento', label: 'Mantenimiento', icon: Settings, path: '/inventario/mantenimiento', permiso: 'inventario.mantenimiento' },
      { id: 'mantenimiento-reportes', label: 'Reportes Mantenimiento', icon: Settings, path: '/inventario/mantenimiento/reportes', permiso: 'inventario.mantenimiento' },
      { id: 'almacenes', label: 'Almacenes', icon: Package, path: '/inventario/almacenes', permiso: 'inventario.almacenes' },
      { id: 'movimientos', label: 'Movimientos', icon: ArrowLeftRight, path: '/inventario/movimientos', permiso: 'inventario.movimientos' },
    ],
  },
  {
    id: 'clientes',
    label: 'Clientes',
    icon: Users,
    path: '/clientes',
    permiso: 'clientes',
  },
  {
    id: 'contratos',
    label: 'Contratos',
    icon: FileText,
    path: '/contratos',
    permiso: 'contratos',
  },
  {
    id: 'operaciones',
    label: 'Operaciones',
    icon: Calendar,
    path: '/operaciones',
    children: [
      { id: 'calendario', label: 'Visitas', icon: Calendar, path: '/operaciones/visitas', permiso: 'operaciones.calendario' },
      { id: 'lecturas', label: 'Lecturas', icon: FileText, path: '/operaciones/lecturas', permiso: 'operaciones.lecturas' },
      { id: 'registros-campo', label: 'Registros de campo', icon: ClipboardList, path: '/operaciones/registros-campo', permiso: 'operaciones.registros-campo' },
    ],
  },
  {
    id: 'finanzas',
    label: 'Finanzas',
    icon: DollarSign,
    path: '/finanzas',
    children: [
      { id: 'facturas', label: 'Facturas', icon: FileText, path: '/finanzas/facturas', permiso: 'finanzas.facturas' },
      { id: 'cfdi', label: 'Comprobantes CFDI', icon: FileCheck2, path: '/finanzas/cfdi', permiso: 'finanzas.cfdi' },
      { id: 'cuentas-por-cobrar', label: 'Cuentas por Cobrar', icon: CreditCard, path: '/finanzas/cuentas-por-cobrar', permiso: 'finanzas.cuentas-por-cobrar' },
      { id: 'cuentas-por-pagar', label: 'Cuentas por Pagar', icon: DollarSign, path: '/finanzas/cuentas-por-pagar', permiso: 'finanzas.cuentas-por-pagar' },
      { id: 'compras', label: 'Compras', icon: ShoppingCart, path: '/finanzas/compras', permiso: 'finanzas.compras' },
      { id: 'rentabilidad', label: 'Rentabilidad', icon: BarChart3, path: '/finanzas/rentabilidad', permiso: 'finanzas.rentabilidad' },
      { id: 'flujo-caja', label: 'Flujo de Caja', icon: TrendingUp, path: '/finanzas/flujo-caja', permiso: 'finanzas.flujo-caja' },
      { id: 'cuentas-bancarias', label: 'Cuentas Bancarias', icon: CreditCard, path: '/finanzas/cuentas-bancarias', permiso: 'finanzas.cuentas-bancarias' },
      { id: 'conciliacion', label: 'Conciliación', icon: FileSearch, path: '/finanzas/conciliacion', permiso: 'finanzas.conciliacion' },
      { id: 'cierre', label: 'Cierre de Periodo', icon: Calendar, path: '/finanzas/cierre', permiso: 'finanzas.cierre' },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    icon: Settings,
    path: '/sistema',
    children: [
      { id: 'usuarios', label: 'Usuarios', icon: Users, path: '/sistema/usuarios', permiso: 'sistema.usuarios' },
      { id: 'notificaciones', label: 'Notificaciones', icon: Bell, path: '/sistema/notificaciones', permiso: 'sistema.notificaciones' },
      { id: 'configuracion', label: 'Configuración', icon: Settings, path: '/sistema/configuracion', permiso: 'sistema.configuracion' },
    ],
  },
  {
    id: 'ayuda',
    label: 'Ayuda',
    icon: HelpCircle,
    path: '/ayuda',
  },
]

/** Reexportado para que componentes que usaban el icono local sigan compilando. */
export { ChevronDown }

/**
 * Filtra el arbol de navegacion segun una funcion de permiso.
 * - Una hoja sin `permiso` es siempre visible (ej. Dashboard).
 * - Un padre se muestra si tiene al menos una hoja visible.
 */
export function filterVisibleNav(
  items: NavItem[],
  tienePermiso: (clave?: string) => boolean
): NavItem[] {
  const isVisible = (item: NavItem): boolean => {
    if (item.children && item.children.length > 0) {
      return item.children.some((c) => isVisible(c))
    }
    return !item.permiso || tienePermiso(item.permiso)
  }

  return items
    .filter(isVisible)
    .map((item) =>
      item.children
        ? { ...item, children: filterVisibleNav(item.children, tienePermiso) }
        : item
    )
}
