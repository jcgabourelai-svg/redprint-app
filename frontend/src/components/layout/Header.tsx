import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Search, Bell, LogOut, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HeaderProps {
  onMenuToggle?: () => void
  userName?: string
  unreadNotifications?: number
  onLogout?: () => void
}

export default function Header({ onMenuToggle, userName, unreadNotifications = 0, onLogout }: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-white px-4 lg:pl-68">
      <button
        type="button"
        className="lg:hidden p-2 rounded-md hover:bg-accent transition-colors"
        onClick={onMenuToggle}
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar..."
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <button
          type="button"
          className="relative p-2 rounded-md hover:bg-accent transition-colors"
          onClick={() => navigate('/notificaciones')}
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadNotifications > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadNotifications > 99 ? '99+' : unreadNotifications}
            </span>
          )}
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            className="flex items-center gap-2 rounded-md p-2 hover:bg-accent transition-colors"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
              {userName ? userName.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
            </div>
            <span className="hidden text-sm font-medium sm:inline-block">{userName}</span>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-md border border-border bg-white shadow-lg py-1">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={() => {
                  setDropdownOpen(false)
                  onLogout?.()
                }}
              >
                <LogOut className="h-4 w-4" />
                Cerrar Sesion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
