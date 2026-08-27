import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import SyncIndicator from './SyncIndicator'

interface NavItem {
  to: string
  label: string
  icon: string
  show: boolean
}

export default function Layout() {
  const { hasPermission } = useAuth()
  const items: NavItem[] = [
    { to: '/', label: 'Visitas', icon: '📅', show: hasPermission('operaciones.calendario') },
    { to: '/notificaciones', label: 'Alertas', icon: '🔔', show: hasPermission('sistema.notificaciones') },
    { to: '/perfil', label: 'Perfil', icon: '👤', show: true },
  ].filter((i) => i.show)

  return (
    <div className="relative mx-auto flex min-h-screen max-w-lg flex-col bg-white shadow-xl">
      <main className="flex-1">
        <Outlet />
      </main>
      <SyncIndicator />
      <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-lg -translate-x-1/2 border-t border-gray-200 bg-white">
        <div className="flex h-14 items-stretch pb-[env(safe-area-inset-bottom)]">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${
                  isActive ? 'font-semibold text-blue-600' : 'text-gray-500'
                }`
              }
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
