import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, Menu, User, Search } from 'lucide-react'
import Button from '@/components/ui/Button'

export interface HeaderProps {
  title?: string
  onMenuClick?: () => void
  showSearch?: boolean
}

export default function Header({
  title,
  onMenuClick,
  showSearch = false,
}: HeaderProps) {
  const location = useLocation()
  const [showNotifications, setShowNotifications] = useState(false)

  const pageTitle = title || (() => {
    const path = location.pathname
    if (path === '/') return 'Dashboard'
    if (path.includes('/inventario')) return 'Inventario'
    if (path.includes('/clientes')) return 'Clientes'
    if (path.includes('/contratos')) return 'Contratos'
    if (path.includes('/operaciones')) return 'Operaciones'
    if (path.includes('/finanzas')) return 'Finanzas'
    return 'RedPrint'
  })()

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        <button
          onClick={onMenuClick}
          className="rounded-md p-2 hover:bg-gray-100 lg:hidden"
        >
          <Menu className="h-6 w-6 text-gray-600" />
        </button>

        <h1 className="text-lg font-semibold text-gray-900">{pageTitle}</h1>

        <div className="flex items-center gap-4">
          {showSearch && (
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar..."
                className="w-64 rounded-md border border-gray-300 py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative rounded-md p-2 hover:bg-gray-100"
            >
              <Bell className="h-5 w-5 text-gray-600" />
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                3
              </span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 rounded-md border border-gray-200 bg-white shadow-lg">
                <div className="border-b border-gray-200 px-4 py-3">
                  <h3 className="font-semibold">Notificaciones</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  <div className="flex gap-3 border-b border-gray-100 p-4 hover:bg-gray-50">
                    <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-red-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        Factura vencida
                      </p>
                      <p className="text-xs text-gray-500">
                        Empresa A tiene una factura vencida de $12,500
                      </p>
                    </div>
                  </div>
                </div>
                <div className="border-t border-gray-200 p-3">
                  <Button variant="ghost" size="sm" className="w-full">
                    Ver todas las notificaciones
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-900">Juan Pérez</p>
              <p className="text-xs text-gray-500">Administrador</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <User className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
