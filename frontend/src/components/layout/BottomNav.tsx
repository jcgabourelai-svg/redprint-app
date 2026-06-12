import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Printer, Calendar, FileText, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BottomNavProps {
  onMenuToggle?: () => void
}

const navItems = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, end: true },
  { label: 'Impresoras', to: '/impresoras', icon: Printer },
  { label: 'Calendario', to: '/calendario', icon: Calendar },
  { label: 'Facturas', to: '/facturas', icon: FileText },
]

export default function BottomNav({ onMenuToggle }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-white h-16 md:hidden">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 py-1 text-[10px] font-medium transition-colors',
              isActive
                ? 'text-primary'
                : 'text-muted-foreground',
            )
          }
        >
          <item.icon className="h-5 w-5" />
          {item.label}
        </NavLink>
      ))}
      <button
        type="button"
        className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        onClick={onMenuToggle}
      >
        <Menu className="h-5 w-5" />
        Mas
      </button>
    </nav>
  )
}
