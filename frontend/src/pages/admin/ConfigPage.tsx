import { useState, useEffect } from 'react'
import { Settings, User, Bell, Palette, Shield, Info, Save, Monitor, Moon, Sun } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Toast from '@/components/ui/Toast'
import { useTheme } from '@/hooks/useTheme'

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
                <p className="text-foreground">1.0.0</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Última actualización</p>
                <p className="text-foreground">11/05/2026</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Entorno</p>
                <p className="text-foreground">Producción</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Licencia</p>
                <p className="text-foreground">RedPrint S.A. de C.V.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Toast
        isOpen={toastOpen}
        onClose={() => setToastOpen(false)}
        variant={toastVariant}
        message={toastMessage}
      />
    </PageLayout>
  )
}