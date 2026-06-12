import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useUsers, useCreateUser } from '@/hooks/useUsers'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { TablePagination } from '@/components/ui/TablePagination'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'
import { UserRole } from '@/types/enums'
import type { User } from '@/types/models'
import api from '@/lib/api'

const roleBadgeVariant: Record<string, 'default' | 'info'> = {
  ADMIN: 'info',
  OPERADOR: 'default',
}

const createUserSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  correo: z.string().email('Correo invalido'),
  telefono: z.string().optional(),
  password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres'),
  rol: z.string().min(1, 'Selecciona un rol'),
})

type CreateUserForm = z.infer<typeof createUserSchema>

export default function UserListPage() {
  const { addToast } = useToast()
  const [page, setPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [resetUserId, setResetUserId] = useState<number | null>(null)

  const { data, isLoading, isError, refetch } = useUsers({ page })
  const createUser = useCreateUser()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
  })

  const onCreateUser = async (formData: CreateUserForm) => {
    try {
      await createUser.mutateAsync(formData)
      addToast('Usuario creado correctamente', 'success')
      setShowCreateModal(false)
      reset()
      refetch()
    } catch {
      addToast('Error al crear usuario', 'error')
    }
  }

  const onResetPassword = async () => {
    if (!resetUserId) return
    try {
      await api.post(`/users/${resetUserId}/reset-password`)
      addToast('Contrasena restablecida correctamente', 'success')
      setResetUserId(null)
    } catch {
      addToast('Error al restablecer contrasena', 'error')
    }
  }

  const roleOptions = Object.values(UserRole).map((r) => ({
    value: r,
    label: r,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Administracion de usuarios del sistema
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          Nuevo Usuario
        </Button>
      </div>

      {isLoading && <LoadingSpinner text="Cargando usuarios..." />}
      {isError && <ErrorMessage message="Error al cargar usuarios" onRetry={() => refetch()} />}

      {data && !isLoading && (
        <>
          {data.data.length === 0 ? (
            <EmptyState title="Sin usuarios" description="No hay usuarios registrados" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead>Telefono</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Activo</TableHead>
                    <TableHead>Ultimo Acceso</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((user: User) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.nombre}</TableCell>
                      <TableCell>{user.correo}</TableCell>
                      <TableCell>{user.telefono ?? '-'}</TableCell>
                      <TableCell>
                        <Badge variant={roleBadgeVariant[user.rol] ?? 'default'}>
                          {user.rol}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.activo ? 'success' : 'error'}>
                          {user.activo ? 'Si' : 'No'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.ultimo_acceso ? formatDate(user.ultimo_acceso) : 'Nunca'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setResetUserId(user.id)}
                        >
                          Reset Password
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                currentPage={data.current_page}
                totalPages={data.last_page}
                onPageChange={setPage}
              />
            </>
          )}
        </>
      )}

      <Modal isOpen={showCreateModal} onClose={() => { setShowCreateModal(false); reset() }} title="Nuevo Usuario">
        <form onSubmit={handleSubmit(onCreateUser)} className="space-y-4">
          <Input
            id="nombre"
            label="Nombre"
            error={errors.nombre?.message}
            {...register('nombre')}
          />
          <Input
            id="correo"
            label="Correo"
            type="email"
            error={errors.correo?.message}
            {...register('correo')}
          />
          <Input
            id="telefono"
            label="Telefono (opcional)"
            error={errors.telefono?.message}
            {...register('telefono')}
          />
          <Input
            id="password"
            label="Contrasena"
            type="password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Select
            id="rol"
            label="Rol"
            options={roleOptions}
            placeholder="Selecciona un rol"
            error={errors.rol?.message}
            {...register('rol')}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setShowCreateModal(false); reset() }}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Crear Usuario
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!resetUserId} onClose={() => setResetUserId(null)} title="Restablecer Contrasena">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Se restablecera la contrasena del usuario a una temporal. El usuario debera cambiarla en su proximo inicio de sesion.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setResetUserId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={onResetPassword}>
              Restablecer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
