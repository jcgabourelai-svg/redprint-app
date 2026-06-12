import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import AuthLayout from '@/components/layout/AuthLayout'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'

const loginSchema = z.object({
  correo: z.string().email('Correo invalido'),
  contrasena: z.string().min(1, 'La contrasena es requerida'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    try {
      setError('')
      await login(data)
      navigate('/')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesion'
      setError(message)
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <h2 className="text-xl font-semibold text-center mb-6">Iniciar Sesion</h2>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <Input
          id="correo"
          label="Correo"
          type="email"
          placeholder="correo@ejemplo.com"
          error={errors.correo?.message}
          {...register('correo')}
        />

        <Input
          id="contrasena"
          label="Contrasena"
          type="password"
          placeholder="********"
          error={errors.contrasena?.message}
          {...register('contrasena')}
        />

        <Button type="submit" className="w-full" loading={isSubmitting}>
          Iniciar Sesion
        </Button>
      </form>
    </AuthLayout>
  )
}
