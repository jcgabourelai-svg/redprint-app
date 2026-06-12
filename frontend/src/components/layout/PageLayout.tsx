import { useState, ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import Header from './Header'

export interface PageLayoutProps {
  title?: string
  showSearch?: boolean
  children?: ReactNode
}

export default function PageLayout({
  title,
  showSearch = false,
  children,
}: PageLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex-1 lg:ml-64">
        <Header
          title={title}
          onMenuClick={() => setSidebarOpen(true)}
          showSearch={showSearch}
        />

        <main className="p-4 lg:p-6 pb-20 lg:pb-6">
          {children || <Outlet />}
        </main>

        <BottomNav onMenuClick={() => setSidebarOpen(true)} />
      </div>
    </div>
  )
}
