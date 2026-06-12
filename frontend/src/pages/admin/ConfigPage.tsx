import { useState, useEffect } from 'react'
import { Settings, User, Bell, Palette, Shield, Info, Save, Monitor, Moon, Sun } from 'lucide-react'
import PageLayout from '@/components/layout/PageLayout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Toast from '@/components/ui/Toast'

type AppConfig = {
  nombre: string
  email: string
  passwordActual: string
  passwordNueva: string
  passwordConfirmar: string
  tema: 'claro' | 'oscuro' | 'sistema'
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
  tema: 'claro',
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch (e) {
    console.error('Failed to save config:', e)
  }
}

export default function ConfigPage() {
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
          <h2 className="text-2xl font-bold text-gray-900">Configuración</h2>
          <p className="text-sm text-gray-500">Administra tu perfil y las preferencias del sistema</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                <CardTitle>Información del Perfil</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Nombre completo</label>
                <Input value={config.nombre} onChange={(e) => setConfig({ ...config, nombre: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Correo electrónico</label>
                <Input type="email" value={config.email} onChange={(e) => setConfig({ ...config, email: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Rol</label>
                <Input value="Administrador" disabled />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Último acceso</label>
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
                <Shield className="h-5 w-5 text-red-600" />
                <CardTitle>Cambiar Contraseña</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Contraseña actual</label>
                <Input type="password" value={config.passwordActual} onChange={(e) => setConfig({ ...config, passwordActual: e.target.value })} placeholder="••••••••••" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Nueva contraseña</label>
                <Input type="password" value={config.passwordNueva} onChange={(e) => setConfig({ ...config, passwordNueva: e.target.value })} placeholder="••••••••••" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Confirmar nueva contraseña</label>
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
                <Palette className="h-5 w-5 text-purple-600" />
                <CardTitle>Preferencias de Visualización</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Tema</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfig({ ...config, tema: 'claro' })}
                    className={`flex items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                      config.tema === 'claro' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Sun className="h-4 w-4" />
                    Claro
                  </button>
                  <button
                    onClick={() => setConfig({ ...config, tema: 'oscuro' })}
                    className={`flex items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                      config.tema === 'oscuro' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Moon className="h-4 w-4" />
                    Oscuro
                  </button>
                  <button
                    onClick={() => setConfig({ ...config, tema: 'sistema' })}
                    className={`flex items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                      config.tema === 'sistema' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Monitor className="h-4 w-4" />
                    Sistema
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Idioma</label>
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
                <label className="mb-1 block text-sm font-medium text-gray-700">Formato de fecha</label>
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
                <Bell className="h-5 w-5 text-amber-600" />
                <CardTitle>Preferencias de Notificaciones</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Notificaciones por correo</p>
                    <p className="text-xs text-gray-500">Recibe alertas en tu email</p>
                  </div>
                  <button
                    onClick={() => setConfig({ ...config, notificacionesEmail: !config.notificacionesEmail })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config.notificacionesEmail ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        config.notificacionesEmail ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Notificaciones en la app</p>
                    <p className="text-xs text-gray-500">Alertas dentro del sistema</p>
                  </div>
                  <button
                    onClick={() => setConfig({ ...config, notificacionesApp: !config.notificacionesApp })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config.notificacionesApp ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        config.notificacionesApp ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="mb-3 text-sm font-medium text-gray-700">Tipos de alertas</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Stock bajo de consumibles</p>
                      <p className="text-xs text-gray-500">Cuando el stock baja del umbral</p>
                    </div>
                    <button
                      onClick={() => setConfig({ ...config, alertasStock: !config.alertasStock })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        config.alertasStock ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          config.alertasStock ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Facturas vencidas</p>
                      <p className="text-xs text-gray-500">Facturas que pasan la fecha de vencimiento</p>
                    </div>
                    <button
                      onClick={() => setConfig({ ...config, alertasVencimiento: !config.alertasVencimiento })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        config.alertasVencimiento ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          config.alertasVencimiento ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Visitas programadas</p>
                      <p className="text-xs text-gray-500">Recordatorios de visitas del día</p>
                    </div>
                    <button
                      onClick={() => setConfig({ ...config, alertasVisitas: !config.alertasVisitas })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        config.alertasVisitas ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
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
              <Info className="h-5 w-5 text-gray-600" />
              <CardTitle>Información del Sistema</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Versión</p>
                <p className="text-gray-900">1.0.0</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Última actualización</p>
                <p className="text-gray-900">11/05/2026</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Entorno</p>
                <p className="text-gray-900">Producción</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Licencia</p>
                <p className="text-gray-900">RedPrint S.A. de C.V.</p>
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