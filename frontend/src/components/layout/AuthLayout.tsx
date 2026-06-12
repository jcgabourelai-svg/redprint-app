import type { ReactNode } from 'react'
import { LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AuthLayoutProps {
  children: ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-primary text-primary-foreground mb-4">
            <LayoutDashboard className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">RedPrint</h1>
          <p className="text-sm text-muted-foreground mt-1">Sistema de Gestion</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  )
}
