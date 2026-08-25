import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { apiErrorMessage } from '../lib/api'
import { Banner, Button, Field, TextInput } from '../components/ui'

export default function LoginPage() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  const canSubmit = correo.trim() !== '' && contrasena !== '' && !submitting

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await login(correo.trim(), contrasena)
      navigate('/', { replace: true })
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-white px-6 shadow-xl">
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="mb-10 text-center">
          <div className="text-6xl">🖨️</div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-800">RedPrint</h1>
          <p className="text-lg font-semibold text-blue-600">Operativo</p>
          <p className="mt-1 text-xs text-gray-400">Sistema de operaciones de campo</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full">
          {error && (
            <div className="mb-4">
              <Banner tone="error">{error}</Banner>
            </div>
          )}
          <Field label="Correo electrónico">
            <TextInput
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="operador@redprint.com"
              autoComplete="email"
              inputMode="email"
            />
          </Field>
          <Field label="Contraseña">
            <TextInput
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </Field>
          <Button type="submit" block disabled={!canSubmit} loading={submitting}>
            Iniciar Sesión
          </Button>
        </form>
      </div>
      <p className="pb-6 text-center text-xs text-gray-400">Versión 3.0.0</p>
    </div>
  )
}
