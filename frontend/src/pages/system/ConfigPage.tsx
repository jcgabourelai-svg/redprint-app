import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'

const profileSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  telefono: z.string().optional(),
})

type ProfileForm = z.infer<typeof profileSchema>

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'La contrasena actual es requerida'),
    new_password: z.string().min(8, 'La nueva contrasena debe tener al menos 8 caracteres'),
    confirm_password: z.string().min(1, 'Confirma la nueva contrasena'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Las contrasenas no coinciden',
    path: ['confirm_password'],
  })

type PasswordForm = z.infer<typeof passwordSchema>

export default function ConfigPage() {
  const { addToast } = useToast()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('perfil')

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nombre: user?.nombre ?? '',
      telefono: user?.telefono ?? '',
    },
  })

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  })

  const onProfileSubmit = async (data: ProfileForm) => {
    try {
      await api.put('/auth/profile', data)
      addToast('Perfil actualizado correctamente', 'success')
    } catch {
      addToast('Error al actualizar perfil', 'error')
    }
  }

  const onPasswordSubmit = async (data: PasswordForm) => {
    try {
      await api.post('/auth/password', {
        current_password: data.current_password,
        new_password: data.new_password,
        confirm_password: data.confirm_password,
      })
      addToast('Contrasena actualizada correctamente', 'success')
      passwordForm.reset()
    } catch {
      addToast('Error al cambiar contrasena', 'error')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuracion</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Administra tu cuenta y preferencias
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="contrasena">Contrasena</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informacion del Perfil</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4 max-w-md">
                <Input
                  id="nombre"
                  label="Nombre"
                  error={profileForm.formState.errors.nombre?.message}
                  {...profileForm.register('nombre')}
                />
                <Input
                  id="telefono"
                  label="Telefono"
                  error={profileForm.formState.errors.telefono?.message}
                  {...profileForm.register('telefono')}
                />
                <Input
                  id="correo"
                  label="Correo"
                  value={user?.correo ?? ''}
                  disabled
                />
                <Button type="submit" loading={profileForm.formState.isSubmitting}>
                  Guardar Cambios
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contrasena">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cambiar Contrasena</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4 max-w-md">
                <Input
                  id="current_password"
                  label="Contrasena actual"
                  type="password"
                  error={passwordForm.formState.errors.current_password?.message}
                  {...passwordForm.register('current_password')}
                />
                <Input
                  id="new_password"
                  label="Nueva contrasena"
                  type="password"
                  error={passwordForm.formState.errors.new_password?.message}
                  {...passwordForm.register('new_password')}
                />
                <Input
                  id="confirm_password"
                  label="Confirmar nueva contrasena"
                  type="password"
                  error={passwordForm.formState.errors.confirm_password?.message}
                  {...passwordForm.register('confirm_password')}
                />
                <Button type="submit" loading={passwordForm.formState.isSubmitting}>
                  Cambiar Contrasena
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
