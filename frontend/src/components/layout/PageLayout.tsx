import { useState, type ReactNode } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import BottomNav from './BottomNav'
import Breadcrumbs from './Breadcrumbs'
import { cn } from '@/lib/utils'
import type { User } from '@/types/models'

interface PageLayoutProps {
  children: ReactNode
  user?: User
  unreadNotifications?: number
  onLogout?: () => void
}

export default function PageLayout({ children, user, unreadNotifications = 0, onLogout }: PageLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <Sidebar userRole={user?.rol} />

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            <Sidebar userRole={user?.rol} />
          </aside>
        </div>
      )}

      <Header
        userName={user?.nombre}
        unreadNotifications={unreadNotifications}
        onLogout={onLogout}
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      <main className="pt-16 pb-16 md:pb-0 lg:pl-64">
        <div className="px-4 sm:px-6 lg:px-8">
          <Breadcrumbs />
          {children}
        </div>
      </main>

      <BottomNav onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
    </div>
  )
}
