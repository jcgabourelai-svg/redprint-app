import { useState, useEffect } from 'react'
import { Bell, Eye, Check, Trash2, AlertTriangle, Info, Calendar, CheckCircle, Filter } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from '@/hooks/useNotifications'
import type { Notification } from '@/types/admin'

const tipoConfig: Record<string, { icon: typeof Bell; color: string; bg: string; label: string }> = {
  alerta: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50', label: 'Alerta' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Advertencia' },
  recordatorio: { icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Recordatorio' },
  info: { icon: Info, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Informacion' },
  exito: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50', label: 'Exito' },
}

export default function NotificationCenterPage() {
  const { data: notificationsData, isLoading, error } = useNotifications()
  const markAsRead = useMarkAsRead()
  const markAllAsRead = useMarkAllAsRead()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filterTipo, setFilterTipo] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (notificationsData?.data) {
      setNotifications(notificationsData.data)
    }
  }, [notificationsData])

  const unreadCount = notifications.filter(n => !n.leida).length

  const filtered = notifications.filter(n => {
    if (filterTipo && n.tipo !== filterTipo) return false
    if (filterEstado === 'leida' && !n.leida) return false
    if (filterEstado === 'no_leida' && n.leida) return false
    if (filterCategoria && n.categoria !== filterCategoria) return false
    return true
  })

  const handleMarkAsRead = async (id: string) => {
    await markAsRead.mutateAsync(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
  }

  const handleMarkAllAsRead = async () => {
    await markAllAsRead.mutateAsync()
    setNotifications(prev => prev.map(n => ({ ...n, leida: true })))
  }

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const markSelectedAsRead = () => {
    setNotifications(prev => prev.map(n => selectedIds.has(n.id) ? { ...n, leida: true } : n))
    setSelectedIds(new Set())
  }

  const deleteSelected = () => {
    setNotifications(prev => prev.filter(n => !selectedIds.has(n.id)))
    setSelectedIds(new Set())
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openDetail = (notif: Notification) => {
    setSelectedNotification(notif)
    setShowDetailModal(true)
    handleMarkAsRead(notif.id)
  }

  return (
    <PageLayout title="Notificaciones" showSearch>
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Sistema</span>
          <span>/</span>
          <span className="text-gray-900 font-medium">Centro de Notificaciones</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-500" />
              <span className="font-medium">{unreadCount} notificaciones nuevas</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <>
                <Button variant="secondary" size="sm" onClick={markSelectedAsRead}>
                  <Check className="mr-1 h-3 w-3" />
                  Marcar seleccionadas ({selectedIds.size})
                </Button>
                <Button variant="danger" size="sm" onClick={deleteSelected}>
                  <Trash2 className="mr-1 h-3 w-3" />
                  Eliminar ({selectedIds.size})
                </Button>
              </>
            )}
            <Button variant="secondary" size="sm" onClick={handleMarkAllAsRead} disabled={markAllAsRead.isPending}>
              Marcar todas como leidas
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Cargando notificaciones...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">Error al cargar notificaciones: {String(error)}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              <Select
                options={[
                  { value: '', label: 'Todos los tipos' },
                  { value: 'alerta', label: 'Alertas' },
                  { value: 'warning', label: 'Advertencias' },
                  { value: 'recordatorio', label: 'Recordatorios' },
                  { value: 'info', label: 'Informacion' },
                  { value: 'exito', label: 'Exitos' },
                ]}
                value={filterTipo}
                onChange={setFilterTipo}
                className="w-44"
              />
              <Select
                options={[
                  { value: '', label: 'Todos los estados' },
                  { value: 'leida', label: 'Leidas' },
                  { value: 'no_leida', label: 'No leidas' },
                ]}
                value={filterEstado}
                onChange={setFilterEstado}
                className="w-44"
              />
              <Select
                options={[
                  { value: '', label: 'Todas las categorias' },
                  { value: 'inventario', label: 'Inventario' },
                  { value: 'finanzas', label: 'Finanzas' },
                  { value: 'operaciones', label: 'Operaciones' },
                  { value: 'general', label: 'General' },
                ]}
                value={filterCategoria}
                onChange={setFilterCategoria}
                className="w-48"
              />
            </div>

            <div className="space-y-3">
              {filtered.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Bell className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No hay notificaciones con estos filtros</p>
                </div>
              )}

              {filtered.map((notif) => {
                const config = tipoConfig[notif.tipo]
                const IconComp = config.icon
                return (
                  <div
                    key={notif.id}
                    className={`bg-white border rounded-lg p-4 transition-colors ${!notif.leida ? 'border-l-4 border-l-blue-500' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(notif.id)}
                        onChange={() => toggleSelect(notif.id)}
                        className="mt-1 rounded border-gray-300"
                      />
                      <div className={`mt-0.5 rounded-full p-2 ${config.bg}`}>
                        <IconComp className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant={
                                notif.tipo === 'alerta' ? 'error' :
                                notif.tipo === 'warning' ? 'warning' :
                                notif.tipo === 'recordatorio' ? 'info' :
                                notif.tipo === 'exito' ? 'success' : 'primary'
                              }
                            >
                              {config.label}
                            </Badge>
                            {!notif.leida && (
                              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                Nueva
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button className="p-1 hover:bg-gray-100 rounded" title="Ver detalle" onClick={() => openDetail(notif)}>
                              <Eye className="h-4 w-4 text-gray-500" />
                            </button>
                            {!notif.leida && (
                              <button className="p-1 hover:bg-gray-100 rounded" title="Marcar como leida" onClick={() => handleMarkAsRead(notif.id)}>
                                <Check className="h-4 w-4 text-blue-500" />
                              </button>
                            )}
                            <button className="p-1 hover:bg-gray-100 rounded" title="Eliminar" onClick={() => deleteNotification(notif.id)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </button>
                          </div>
                        </div>
                        <p className={`text-sm mt-1 ${!notif.leida ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                          {notif.mensaje}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-gray-400">{notif.fecha} {notif.hora}</span>
                          {notif.accion && (
                            <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                              {notif.accion.texto}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Mostrando {filtered.length} de {notifications.length} notificaciones</span>
              <div className="flex gap-1">
                <button className="px-3 py-1 border rounded hover:bg-gray-50">{'<'}</button>
                <button className="px-3 py-1 border rounded bg-blue-500 text-white">1</button>
                <button className="px-3 py-1 border rounded hover:bg-gray-50">2</button>
                <button className="px-3 py-1 border rounded hover:bg-gray-50">3</button>
                <button className="px-3 py-1 border rounded hover:bg-gray-50">{'>'}</button>
              </div>
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setSelectedNotification(null) }}
        title="Detalle de Notificacion"
        size="lg"
      >
        {selectedNotification && (
          <div className="space-y-4">
            {(() => {
              const config = tipoConfig[selectedNotification.tipo]
              const IconComp = config.icon
              return (
                <div className="flex items-start gap-3 bg-gray-50 p-4 rounded-lg">
                  <div className={`rounded-full p-2 ${config.bg}`}>
                    <IconComp className={`h-5 w-5 ${config.color}`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{selectedNotification.mensaje}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedNotification.fecha} {selectedNotification.hora}
                    </p>
                  </div>
                </div>
              )
            })()}

            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <h4 className="font-medium text-gray-900">Informacion</h4>
              <p className="text-sm text-gray-600">Tipo: <Badge
                variant={
                  selectedNotification.tipo === 'alerta' ? 'error' :
                  selectedNotification.tipo === 'warning' ? 'warning' :
                  selectedNotification.tipo === 'recordatorio' ? 'info' :
                  selectedNotification.tipo === 'exito' ? 'success' : 'primary'
                }
              >
                {tipoConfig[selectedNotification.tipo].label}
              </Badge></p>
              <p className="text-sm text-gray-600">Estado: <Badge variant={selectedNotification.leida ? 'success' : 'warning'}>{selectedNotification.leida ? 'Leida' : 'No leida'}</Badge></p>
              {selectedNotification.categoria && (
                <p className="text-sm text-gray-600">Categoria: <strong>{selectedNotification.categoria}</strong></p>
              )}
            </div>

            {selectedNotification.accion && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Acciones</h4>
                <Button variant="outline" size="sm">
                  {selectedNotification.accion.texto}
                </Button>
              </div>
            )}

            <div className="bg-gray-50 p-4 rounded-lg space-y-1">
              <h4 className="font-medium text-gray-900 mb-1">Historial</h4>
              <p className="text-sm text-gray-600">Creada: {selectedNotification.fecha} {selectedNotification.hora} por el sistema</p>
              <p className="text-sm text-gray-600">Estado actual: {selectedNotification.leida ? 'Leida' : 'No leida'}</p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              {!selectedNotification.leida && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    handleMarkAsRead(selectedNotification.id)
                    setSelectedNotification({ ...selectedNotification, leida: true })
                  }}
                >
                  Marcar como leida
                </Button>
              )}
              <Button variant="secondary" onClick={() => { setShowDetailModal(false); setSelectedNotification(null) }}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageLayout>
  )
}