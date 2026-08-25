import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSyncQueue } from '../hooks/useSyncQueue'
import { Button, Card, Page, PageHeader, SectionTitle } from '../components/ui'

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const { items } = useSyncQueue()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)
  const [showPerms, setShowPerms] = useState(false)

  if (!user) return null

  const pending = items.filter((i) => i.estado === 'pendiente').length
  const errors = items.filter((i) => i.estado === 'error').length

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div>
      <PageHeader title="Perfil" />
      <Page>
        <Card className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-3xl">
            👤
          </div>
          <h2 className="text-lg font-bold text-gray-800">{user.nombre}</h2>
          <p className="text-sm text-gray-500">{user.correo}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-blue-600">
            {user.rol_nombre ?? user.rol_slug ?? 'Sin rol'}
          </p>
        </Card>

        {(pending > 0 || errors > 0) && (
          <Card className="mb-6">
            <p className="text-sm font-semibold text-gray-800">Sincronización</p>
            <p className="mt-1 text-xs text-gray-500">
              {pending} lectura(s) pendiente(s) · {errors} con error
            </p>
          </Card>
        )}

        <section className="mb-6">
          <SectionTitle>Permisos ({user.permisos.length})</SectionTitle>
          <button
            onClick={() => setShowPerms((s) => !s)}
            className="text-sm font-semibold text-blue-600"
          >
            {showPerms ? 'Ocultar' : 'Mostrar'} permisos
          </button>
          {showPerms && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {user.permisos.map((p) => (
                <span
                  key={p}
                  className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600"
                >
                  {p}
                </span>
              ))}
            </div>
          )}
        </section>

        <Button variant="outline" block loading={loggingOut} onClick={() => void handleLogout()}>
          Cerrar Sesión
        </Button>

        <p className="mt-8 text-center text-xs text-gray-400">
          RedPrint Operativo · v3.0.0 (prototipo3)
        </p>
      </Page>
    </div>
  )
}
