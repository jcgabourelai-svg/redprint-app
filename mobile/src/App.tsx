import { useEffect } from 'react'
import type { JSX } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ToastProvider } from './components/Toast'
import Layout from './components/Layout'
import { SyncManager } from './lib/sync'
import LoginPage from './pages/LoginPage'
import TodayPage from './pages/TodayPage'
import CalendarPage from './pages/CalendarPage'
import VisitDetailPage from './pages/VisitDetailPage'
import PrinterDetailPage from './pages/PrinterDetailPage'
import CaptureReadingPage from './pages/CaptureReadingPage'
import InstallationPage from './pages/InstallationPage'
import RemovalPage from './pages/RemovalPage'
import NewVisitPage from './pages/NewVisitPage'
import DeliveryPage from './pages/DeliveryPage'
import ReportFailurePage from './pages/ReportFailurePage'
import NotificationsPage from './pages/NotificationsPage'
import ProfilePage from './pages/ProfilePage'

function SyncBoot() {
  useEffect(() => {
    void SyncManager.start()
  }, [])
  return null
}

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="text-center">
        <div className="text-5xl">🖨️</div>
        <p className="mt-3 text-sm font-semibold text-gray-400">RedPrint Operativo</p>
      </div>
    </div>
  )
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter basename="/m">
      <AuthProvider>
        <ToastProvider>
          <SyncBoot />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route index element={<TodayPage />} />
              <Route path="calendario" element={<CalendarPage />} />
              {/* Ruta estática antes de visita/:id para que "nueva" no se capture como id */}
              <Route path="visita/nueva" element={<NewVisitPage />} />
              <Route path="visita/:id" element={<VisitDetailPage />} />
              <Route path="visita/:id/impresora/:printerId" element={<PrinterDetailPage />} />
              <Route path="visita/:id/captura/:printerId" element={<CaptureReadingPage />} />
              <Route path="visita/:id/instalacion" element={<InstallationPage />} />
              <Route path="visita/:id/retiro" element={<RemovalPage />} />
              <Route path="visita/:id/entrega" element={<DeliveryPage />} />
              <Route path="visita/:id/falla" element={<ReportFailurePage />} />
              <Route path="notificaciones" element={<NotificationsPage />} />
              <Route path="perfil" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
