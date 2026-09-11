import { useState, useEffect, useRef } from 'react'
import { Settings, User, Bell, Palette, Shield, Info, Save, Monitor, Moon, Sun, RefreshCw } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Toast from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { useTienePermiso } from '@/contexts/AuthContext'
import { useTheme } from '@/hooks/useTheme'
import { requestUpdate, getUpdateStatus, getUpdateVersion } from '@/lib/api'
import { formatDateTime } from '@/lib/formatters'
import type { UpdateStatus, UpdateVersion } from '@/lib/api'

type AppConfig = {
  nombre: string
  email: string
  passwordActual: string
  passwordNueva: string
  passwordConfirmar: string
  idioma: 'es' | 'en'
  formatoFecha: 'dd/mm/aaaa' | 'mm/dd/aaaa' | 'aaaa-mm-dd'
  notificacionesEmail: boolean
  notificacionesApp: boolean
  alertasStock: boolean
  alertasVencimiento: boolean
  alertasVisitas: boolean
}

const defaultConfig: AppConfig = {
  nombre: '',
  email: '',
  passwordActual: '',
  passwordNueva: '',
  passwordConfirmar: '',
  idioma: 'es',
  formatoFecha: 'dd/mm/aaaa',
  notificacionesEmail: true,
  notificacionesApp: true,
  alertasStock: true,
  alertasVencimiento: true,
  alertasVisitas: true,
}

const STORAGE_KEY = 'redprint_config'

function getStoredConfig(): AppConfig {
  if (typeof window === 'undefined') return defaultConfig
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? { ...defaultConfig, ...JSON.parse(stored) } : defaultConfig
  } catch {
    return defaultConfig
  }
}

function saveStoredConfig(config: AppConfig): void {
  if (typeof window === 'undefined') return
  try {
    // Merge onto existing storage para no sobrescribir el campo `tema`
    // gestionado por el ThemeProvider.
    const existing = localStorage.getItem(STORAGE_KEY)
    const parsed = existing ? JSON.parse(existing) : {}
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, ...config }))
  } catch (e) {
    console.error('Failed to save config:', e)
  }
}

export default function ConfigPage() {
  const { tema, setTema } = useTheme()
  const [config, setConfig] = useState<AppConfig>(getStoredConfig)
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastVariant, setToastVariant] = useState<'success' | 'error'>('success')

  // --- Actualización del Sistema -------------------------------------------
  const puedeActualizar = useTienePermiso('sistema.actualizar')
  const [version, setVersion] = useState<UpdateVersion | null>(null)
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const [terminoRecien, setTerminoRecien] = useState<'listo' | null>(null)
  const [hintCron, setHintCron] = useState(false)
  const notificadoRef = useRef(false)
  const enColaDesdeRef = useRef<number | null>(null)
  const logRef = useRef<HTMLPreElement>(null)

  const enCurso = status?.estado === 'en_cola' || status?.estado === 'corriendo'

  // Al montar: refleja una actualización iniciada desde otra pestaña/sesión.
  useEffect(() => {
    if (!puedeActualizar) return
    getUpdateVersion().then((r) => setVersion(r.version)).catch(() => {})
    getUpdateStatus().then((s) => setStatus(s)).catch(() => {})
  }, [puedeActualizar])

  // Polling cada 2 s mientras hay algo en curso. Durante la ventana de
  // reinicio (php-fpm up -d) los polls fallan con 502/conexión rechazada:
  // NO se tratan como error fatal, se mantiene el estado y se reintenta.
  useEffect(() => {
    if (!enCurso) return
    let cancelado = false
    const id = setInterval(async () => {
      try {
        const s = await getUpdateStatus()
        if (cancelado) return
        setStatus(s)
        if (s.estado === 'en_cola') {
          if (enColaDesdeRef.current === null) {
            enColaDesdeRef.current = Date.now()
          } else if (Date.now() - enColaDesdeRef.current > 120000) {
            setHintCron(true)
          }
        } else {
          enColaDesdeRef.current = null
          setHintCron(false)
        }
        if (!notificadoRef.current && s.estado === 'listo') {
          notificadoRef.current = true
          setTerminoRecien('listo')
          setToastMessage('Actualización completada')
          setToastVariant('success')
          setToastOpen(true)
          getUpdateVersion().then((r) => setVersion(r.version)).catch(() => {})
        }
        if (!notificadoRef.current && s.estado === 'error') {
          notificadoRef.current = true
          setToastMessage('La actualización falló')
          setToastVariant('error')
          setToastOpen(true)
        }
      } catch {
        /* ventana de reinicio: reintenta el siguiente tick */
      }
    }, 2000)
    return () => {
      cancelado = true
      clearInterval(id)
    }
  }, [enCurso])

  // Auto-scroll del log en vivo.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [status?.log])

  const confirmarActualizacion = async () => {
    setStarting(true)
    try {
      await requestUpdate()
      notificadoRef.current = false
      setTerminoRecien(null)
      enColaDesdeRef.current = Date.now()
      setStatus((prev) => ({
        estado: 'en_cola',
        rama: prev?.rama ?? null,
        sha: null,
        inicio: null,
        fin: null,
        detalle: null,
        log: null,
      }))
      setConfirmOpen(false)
    } catch (err: any) {
      setToastMessage(err?.response?.data?.message || 'No se pudo solicitar la actualización')
      setToastVariant('error')
      setToastOpen(true)
    } finally {
      setStarting(false)
    }
  }

  const badgeEstado =
    status?.estado === 'en_cola'
      ? { variant: 'info' as const, label: 'En cola' }
      : status?.estado === 'corriendo'
        ? { variant: 'warning' as const, label: 'Actualizando…' }
        : status?.estado === 'error'
          ? { variant: 'error' as const, label: 'Error' }
          : status?.estado === 'listo'
            ? { variant: 'neutral' as const, label: 'Actualizado' }
            : { variant: 'neutral' as const, label: 'Sin novedad' }

  useEffect(() => {
    saveStoredConfig(config)
  }, [config])

  const handleSavePerfil = () => {
    setToastMessage('Perfil actualizado correctamente')
    setToastVariant('success')
    setToastOpen(true)
  }

  const handleSavePassword = () => {
    if (!config.passwordActual || !config.passwordNueva || !config.passwordConfirmar) {
      setToastMessage('Complete todos los campos de contraseña')
      setToastVariant('error')
      setToastOpen(true)
      return
    }
    if (config.passwordNueva !== config.passwordConfirmar) {
      setToastMessage('Las contrasenas no coinciden')
      setToastVariant('error')
      setToastOpen(true)
      return
    }
    setConfig({ ...config, passwordActual: '', passwordNueva: '', passwordConfirmar: '' })
    setToastMessage('Contraseña actualizada correctamente')
    setToastVariant('success')
    setToastOpen(true)
  }

  const handleSavePreferencias = () => {
    setToastMessage('Preferencias guardadas correctamente')
    setToastVariant('success')
    setToastOpen(true)
  }

  return (
    <PageLayout title="Sistema › Configuración">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Configuración</h2>
          <p className="text-sm text-muted-foreground">Administra tu perfil y las preferencias del sistema</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle>Información del Perfil</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Nombre completo</label>
                <Input value={config.nombre} onChange={(e) => setConfig({ ...config, nombre: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Correo electrónico</label>
                <Input type="email" value={config.email} onChange={(e) => setConfig({ ...config, email: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Rol</label>
                <Input value="Administrador" disabled />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Último acceso</label>
                <Input value="08/05/2026 14:35" disabled />
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={handleSavePerfil}>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Cambios
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-destructive" />
                <CardTitle>Cambiar Contraseña</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Contraseña actual</label>
                <Input type="password" value={config.passwordActual} onChange={(e) => setConfig({ ...config, passwordActual: e.target.value })} placeholder="••••••••••" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Nueva contraseña</label>
                <Input type="password" value={config.passwordNueva} onChange={(e) => setConfig({ ...config, passwordNueva: e.target.value })} placeholder="••••••••••" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Confirmar nueva contraseña</label>
                <Input type="password" value={config.passwordConfirmar} onChange={(e) => setConfig({ ...config, passwordConfirmar: e.target.value })} placeholder="••••••••••" />
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={handleSavePassword}>
                  <Shield className="mr-2 h-4 w-4" />
                  Actualizar Contraseña
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                <CardTitle>Preferencias de Visualización</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Tema</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setTema('claro')}
                    className={`flex items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                      tema === 'claro' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Sun className="h-4 w-4" />
                    Claro
                  </button>
                  <button
                    onClick={() => setTema('oscuro')}
                    className={`flex items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                      tema === 'oscuro' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Moon className="h-4 w-4" />
                    Oscuro
                  </button>
                  <button
                    onClick={() => setTema('sistema')}
                    className={`flex items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                      tema === 'sistema' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Monitor className="h-4 w-4" />
                    Sistema
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Idioma</label>
                <Select
                  value={config.idioma}
                  onChange={(v) => setConfig({ ...config, idioma: v })}
                  options={[
                    { value: 'es', label: 'Español' },
                    { value: 'en', label: 'English' },
                  ]}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Formato de fecha</label>
                <Select
                  value={config.formatoFecha}
                  onChange={(v) => setConfig({ ...config, formatoFecha: v })}
                  options={[
                    { value: 'dd/mm/aaaa', label: 'DD/MM/AAAA (México)' },
                    { value: 'mm/dd/aaaa', label: 'MM/DD/AAAA (EEUU)' },
                    { value: 'aaaa-mm-dd', label: 'AAAA-MM-DD (ISO)' },
                  ]}
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={handleSavePreferencias}>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Preferencias
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-warning" />
                <CardTitle>Preferencias de Notificaciones</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Notificaciones por correo</p>
                    <p className="text-xs text-muted-foreground">Recibe alertas en tu email</p>
                  </div>
                  <button
                    onClick={() => setConfig({ ...config, notificacionesEmail: !config.notificacionesEmail })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config.notificacionesEmail ? 'bg-primary' : 'bg-muted-foreground'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                        config.notificacionesEmail ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Notificaciones en la app</p>
                    <p className="text-xs text-muted-foreground">Alertas dentro del sistema</p>
                  </div>
                  <button
                    onClick={() => setConfig({ ...config, notificacionesApp: !config.notificacionesApp })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config.notificacionesApp ? 'bg-primary' : 'bg-muted-foreground'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                        config.notificacionesApp ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="mb-3 text-sm font-medium text-muted-foreground">Tipos de alertas</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Stock bajo de consumibles</p>
                      <p className="text-xs text-muted-foreground">Cuando el stock baja del umbral</p>
                    </div>
                    <button
                      onClick={() => setConfig({ ...config, alertasStock: !config.alertasStock })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        config.alertasStock ? 'bg-primary' : 'bg-muted-foreground'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                          config.alertasStock ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Facturas vencidas</p>
                      <p className="text-xs text-muted-foreground">Facturas que pasan la fecha de vencimiento</p>
                    </div>
                    <button
                      onClick={() => setConfig({ ...config, alertasVencimiento: !config.alertasVencimiento })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        config.alertasVencimiento ? 'bg-primary' : 'bg-muted-foreground'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                          config.alertasVencimiento ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Visitas programadas</p>
                      <p className="text-xs text-muted-foreground">Recordatorios de visitas del día</p>
                    </div>
                    <button
                      onClick={() => setConfig({ ...config, alertasVisitas: !config.alertasVisitas })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        config.alertasVisitas ? 'bg-primary' : 'bg-muted-foreground'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                          config.alertasVisitas ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSavePreferencias}>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Notificaciones
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Información del Sistema</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Versión</p>
                <p className="text-foreground">{version ? version.sha.slice(0, 7) : '—'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Rama</p>
                <p className="text-foreground">{version?.rama ?? '—'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Última actualización</p>
                <p className="text-foreground">{version ? formatDateTime(version.fecha) : '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {puedeActualizar && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-primary" />
                  <CardTitle>Actualización del Sistema</CardTitle>
                </div>
                <Badge variant={badgeEstado.variant}>{badgeEstado.label}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Actualiza la aplicación al último commit de la rama{' '}
                <span className="font-medium text-foreground">{status?.rama ?? 'main'}</span>. El
                orquestador del VPS respalda la base de datos antes de tocar nada.
              </p>

              {status?.estado === 'error' && (
                <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                  <p className="text-sm font-medium text-destructive">
                    La última actualización falló{status.detalle ? `: ${status.detalle}` : '.'}
                  </p>
                  {status.log && (
                    <pre
                      ref={logRef}
                      className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-background p-2 text-xs text-muted-foreground"
                    >
                      {status.log}
                    </pre>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Para diagnosticar: revisa <code>/var/log/redprint/update.log</code> por SSH en
                    el VPS.
                  </p>
                </div>
              )}

              {terminoRecien === 'listo' && (
                <p className="text-sm text-success">
                  Actualización completada. Recarga con Ctrl+F5 para cargar la nueva versión.
                </p>
              )}

              {status?.estado === 'corriendo' && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Actualizando a {status.sha ? status.sha.slice(0, 7) : 'main'}…
                  </p>
                  {status.log && (
                    <pre
                      ref={logRef}
                      className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs text-muted-foreground"
                    >
                      {status.log}
                    </pre>
                  )}
                </div>
              )}

              {status?.estado === 'en_cola' && (
                <p className="text-sm text-muted-foreground">
                  Esperando al orquestador (hasta ~60 s)…
                  {hintCron &&
                    ' Si no cambia en ~2 min, verifica `crontab -l` y /var/log/redprint/cron.log en el VPS.'}
                </p>
              )}

              <div className="flex justify-end pt-2">
                <Button onClick={() => setConfirmOpen(true)} disabled={enCurso} loading={starting}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Actualizar ahora
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Actualizar sistema"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Se respaldará la base de datos y la app puede tardar{' '}
            <strong className="text-foreground">1–3 minutos</strong> en volver (la sesión no se
            pierde). El sistema se actualizará al último commit de{' '}
            <strong className="text-foreground">main</strong>.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button variant="danger" loading={starting} onClick={confirmarActualizacion}>
              Actualizar ahora
            </Button>
          </div>
        </div>
      </Modal>

      <Toast
        isOpen={toastOpen}
        onClose={() => setToastOpen(false)}
        variant={toastVariant}
        message={toastMessage}
      />
    </PageLayout>
  )
}