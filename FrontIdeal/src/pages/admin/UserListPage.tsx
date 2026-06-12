import { useState, useEffect } from 'react'
import { Users, Plus, Eye, Pencil, Trash2, Shield, ShieldCheck } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Tabs from '@/components/ui/Tabs'
import { Card, CardContent } from '@/components/ui/Card'
import { formatDate } from '@/lib/formatters'
import { useUsers, useResetUserPassword } from '@/hooks/useUsers'
import type { User } from '@/types/admin'
import { parseApiError } from '@/lib/api-errors'

export default function UserListPage() {
  const { data: usersData, isLoading, error } = useUsers()
  const resetUserPassword = useResetUserPassword()
  const [users, setUsers] = useState<User[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [passwordUser, setPasswordUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({ nombre: '', email: '', password: '', confirmarPassword: '', rol: 'OPERADOR' as 'ADMIN' | 'OPERADOR', activo: true })
  const [formError, setFormError] = useState('')
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmarPassword: '' })
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    if (usersData?.data) {
      setUsers(usersData.data)
    }
  }, [usersData])

  const adminCount = users.filter(u => u.rol === 'ADMIN').length
  const operadorCount = users.filter(u => u.rol === 'OPERADOR').length
  const activoCount = users.filter(u => u.activo).length

  const openCreate = () => {
    setEditingUser(null)
    setFormData({ nombre: '', email: '', password: '', confirmarPassword: '', rol: 'OPERADOR', activo: true })
    setShowModal(true)
    setFormError('')
  }

  const openEdit = (user: User) => {
    setEditingUser(user)
    setFormData({ nombre: user.nombre, email: user.email, password: '', confirmarPassword: '', rol: user.rol, activo: user.activo })
    setShowModal(true)
    setFormError('')
  }

  const openPassword = (user: User) => {
    setPasswordUser(user)
    setPasswordForm({ password: '', confirmarPassword: '' })
    setShowPasswordModal(true)
    setPasswordError('')
  }

  const handleSave = async () => {
    setFormError('')
    if (formData.password !== formData.confirmarPassword) {
      setFormError('Las contrasenas no coinciden')
      return
    }
    if (formData.rol === 'OPERADOR' && users.filter(u => u.rol === 'ADMIN').length < 1 && !editingUser) {
      setFormError('Debe haber al menos un administrador en el sistema')
      return
    }
    setShowModal(false)
  }

  const handleDelete = () => {
    if (deletingUser) {
      setUsers(prev => prev.filter(u => u.id !== deletingUser.id))
    }
    setShowDeleteModal(false)
    setDeletingUser(null)
  }

  const handleResetPassword = async () => {
    setPasswordError('')
    if (passwordForm.password !== passwordForm.confirmarPassword) {
      setPasswordError('Las contrasenas no coinciden')
      return
    }
    if (!passwordUser) return
    
    try {
      await resetUserPassword.mutateAsync({ id: passwordUser.id, password: passwordForm.password })
      setShowPasswordModal(false)
      setPasswordForm({ password: '', confirmarPassword: '' })
    } catch (err) {
      setPasswordError(parseApiError(err))
    }
  }

  const usersTab = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion de Usuarios</h2>
          <p className="text-sm text-gray-500">Administra usuarios y roles del sistema</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Cargando usuarios...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error al cargar usuarios: {String(error)}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-50 p-2">
                    <Users className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Usuarios</p>
                    <p className="text-lg font-bold">{users.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-50 p-2">
                    <ShieldCheck className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Activos</p>
                    <p className="text-lg font-bold">{activoCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-purple-50 p-2">
                    <Shield className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Roles</p>
                    <p className="text-lg font-bold">{adminCount} Admin, {operadorCount} Op.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Nombre</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Correo</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Rol</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Estado</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Ultimo Acceso</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{user.nombre}</td>
                      <td className="py-3 px-4 text-gray-600">{user.email}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={user.rol === 'ADMIN' ? 'primary' : 'neutral'}>
                          {user.rol === 'ADMIN' ? 'ADMIN' : 'OPERADOR'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={user.activo ? 'success' : 'error'}>
                          {user.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center text-gray-600 text-xs">{user.ultimo_acceso || 'Nunca'}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button className="p-1 hover:bg-gray-100 rounded" title="Ver detalle" onClick={() => { setSelectedUser(user); setShowDetailModal(true) }}>
                            <Eye className="h-4 w-4 text-gray-500" />
                          </button>
                          <button className="p-1 hover:bg-gray-100 rounded" title="Editar" onClick={() => openEdit(user)}>
                            <Pencil className="h-4 w-4 text-blue-500" />
                          </button>
                          <button className="p-1 hover:bg-gray-100 rounded" title="Resetear contrasena" onClick={() => openPassword(user)}>
                            <Shield className="h-4 w-4 text-amber-500" />
                          </button>
                          <button className="p-1 hover:bg-gray-100 rounded" title="Eliminar" onClick={() => { setDeletingUser(user); setShowDeleteModal(true) }}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-sm text-gray-600">
            Total: {users.length} usuarios ({adminCount} Admin, {operadorCount} Operador)
          </div>
        </>
      )}
    </div>
  )

  return (
    <PageLayout title="Administracion" showSearch>
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Sistema</span>
          <span>/</span>
          <span className="text-gray-900 font-medium">Gestion de Usuarios</span>
        </div>

        <Tabs
          tabs={[
            { id: 'usuarios', label: 'Usuarios', content: usersTab },
          ]}
          defaultTab="usuarios"
        />
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
            <Input
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder="Juan Perez"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo electronico *</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="juan@socios.com"
            />
          </div>

          {!editingUser && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contrasena *</label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Contrasena segura"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contrasena *</label>
                <Input
                  type="password"
                  value={formData.confirmarPassword}
                  onChange={(e) => setFormData({ ...formData, confirmarPassword: e.target.value })}
                  placeholder="Repetir contrasena"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
            <Select
              options={[
                { value: 'ADMIN', label: 'Administrador' },
                { value: 'OPERADOR', label: 'Operador' },
              ]}
              value={formData.rol}
              onChange={(v) => setFormData({ ...formData, rol: v })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado *</label>
            <Select
              options={[
                { value: 'true', label: 'Activo' },
                { value: 'false', label: 'Inactivo' },
              ]}
              value={String(formData.activo)}
              onChange={(v) => setFormData({ ...formData, activo: v === 'true' })}
            />
          </div>

          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{formError}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Guardar
            </Button>
          </div>
        </div>
      </Modal>

      {selectedUser && (
        <Modal
          isOpen={showDetailModal}
          onClose={() => { setShowDetailModal(false); setSelectedUser(null) }}
          title={selectedUser.nombre}
          size="lg"
        >
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <p className="text-sm text-gray-600">Nombre: <strong>{selectedUser.nombre}</strong></p>
              <p className="text-sm text-gray-600">Correo: <strong>{selectedUser.email}</strong></p>
              <p className="text-sm text-gray-600">
                Rol:{' '}
                <Badge variant={selectedUser.rol === 'ADMIN' ? 'primary' : 'neutral'}>
                  {selectedUser.rol === 'ADMIN' ? 'ADMIN' : 'OPERADOR'}
                </Badge>
              </p>
              <p className="text-sm text-gray-600">
                Estado:{' '}
                <Badge variant={selectedUser.activo ? 'success' : 'error'}>
                  {selectedUser.activo ? 'Activo' : 'Inactivo'}
                </Badge>
              </p>
              <p className="text-sm text-gray-600">Creado: <strong>{formatDate(selectedUser.fecha_creacion)}</strong></p>
              <p className="text-sm text-gray-600">Ultimo acceso: <strong>{selectedUser.ultimo_acceso || 'Nunca'}</strong></p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="secondary" onClick={() => { setShowDetailModal(false); setSelectedUser(null) }}>
                Cerrar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <Modal
        isOpen={showPasswordModal}
        onClose={() => { setShowPasswordModal(false); setPasswordUser(null) }}
        title="Resetear Contrasena"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Desea resetear la contrasena del usuario <strong>{passwordUser?.nombre}</strong>?
            Esta accion enviara un correo para que el usuario establezca una nueva contrasena.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contrasena temporal *</label>
            <Input
              type="password"
              value={passwordForm.password}
              onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
              placeholder="Contrasena segura"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contrasena *</label>
            <Input
              type="password"
              value={passwordForm.confirmarPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmarPassword: e.target.value })}
              placeholder="Repetir contrasena"
            />
          </div>

          {passwordError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{passwordError}</p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => { setShowPasswordModal(false); setPasswordUser(null) }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleResetPassword}
              disabled={resetUserPassword.isPending}
            >
              {resetUserPassword.isPending ? 'Enviando...' : 'Resetear'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeletingUser(null) }}
        title="Eliminar Usuario"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Estas seguro de que deseas eliminar al usuario <strong>{deletingUser?.nombre}</strong>?
            Esta accion no se puede deshacer.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => { setShowDeleteModal(false); setDeletingUser(null) }}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}