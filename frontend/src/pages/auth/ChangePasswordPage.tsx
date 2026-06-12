import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import api from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'La contrasena actual es requerida'),
    new_password: z.string().min(8, 'La nueva contrasena debe tener al menos 8 caracteres'),
    confirm_password: z.string().min(1, 'Confirma la nueva contrasena'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Las contrasenas no coinciden',
    path: ['confirm_password'],
  })

type ChangePasswordForm = z.infer<typeof changePasswordSchema>

export default function ChangePasswordPage() {
  const { addToast } = useToast()
  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
  })

  const onSubmit = async (data: ChangePasswordForm) => {
    try {
      setError('')
      await api.post('/auth/password', {
        current_password: data.current_password,
        new_password: data.new_password,
        confirm_password: data.confirm_password,
      })
      addToast('Contrasena actualizada correctamente', 'success')
      reset()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cambiar la contrasena'
      setError(message)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-bold">Cambiar Contrasena</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Actualiza tu contrasena de acceso
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <Input
          id="current_password"
          label="Contrasena actual"
          type="password"
          error={errors.current_password?.message}
          {...register('current_password')}
        />

        <Input
          id="new_password"
          label="Nueva contrasena"
          type="password"
          error={errors.new_password?.message}
          {...register('new_password')}
        />

        <Input
          id="confirm_password"
          label="Confirmar nueva contrasena"
          type="password"
          error={errors.confirm_password?.message}
          {...register('confirm_password')}
        />

        <Button type="submit" className="w-full" loading={isSubmitting}>
          Cambiar Contrasena
        </Button>
      </form>
    </div>
  )
}
