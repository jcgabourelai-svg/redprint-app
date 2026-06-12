import { useState } from 'react'
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
} from '@/hooks/useNotifications'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Bell, BellOff, CheckCheck } from 'lucide-react'

type FilterValue = 'all' | 'unread' | 'read'

export default function NotificationCenterPage() {
  const [filter, setFilter] = useState<FilterValue>('all')
  const [page, setPage] = useState(1)

  const params: Record<string, string | number> = { page }
  if (filter === 'unread') params.leida = 'false'
  if (filter === 'read') params.leida = 'true'

  const { data, isLoading, isError, refetch } = useNotifications(params)
  const markAsRead = useMarkAsRead()
  const markAllAsRead = useMarkAllAsRead()

  const handleMarkAsRead = (id: number) => {
    markAsRead.mutate(id)
  }

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate(undefined, { onSuccess: () => refetch() })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Notificaciones</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Centro de notificaciones
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleMarkAllAsRead}
          loading={markAllAsRead.isPending}
        >
          <CheckCheck className="h-4 w-4 mr-2" />
          Marcar todas como leidas
        </Button>
      </div>

      <Tabs value={filter} onValueChange={(v) => { setFilter(v as FilterValue); setPage(1) }}>
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="unread">No leidas</TabsTrigger>
          <TabsTrigger value="read">Leidas</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && <LoadingSpinner text="Cargando notificaciones..." />}
      {isError && <ErrorMessage message="Error al cargar notificaciones" onRetry={() => refetch()} />}

      {data && !isLoading && (
        <>
          {data.data.length === 0 ? (
            <EmptyState
              icon={<BellOff className="h-12 w-12" />}
              title="Sin notificaciones"
              description="No hay notificaciones para mostrar"
            />
          ) : (
            <div className="space-y-2">
              {data.data.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => {
                    if (!notification.leida) handleMarkAsRead(Number(notification.id))
                  }}
                  className={cn(
                    'rounded-lg border p-4 transition-colors cursor-pointer',
                    notification.leida
                      ? 'bg-background border-border'
                      : 'bg-primary/5 border-primary/20',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn('mt-0.5', notification.leida ? 'text-muted-foreground' : 'text-primary')}>
                      <Bell className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className={cn('text-sm', notification.leida ? 'font-medium' : 'font-semibold')}>
                          {notification.titulo}
                        </h4>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(notification.fecha)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.mensaje}
                      </p>
                    </div>
                    {!notification.leida && (
                      <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
