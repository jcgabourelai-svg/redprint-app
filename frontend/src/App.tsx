import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { PageLayout } from '@/components/layout'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { UserRole } from '@/types/enums'
import type { ReactNode } from 'react'

import LoginPage from '@/pages/auth/LoginPage'
import ChangePasswordPage from '@/pages/auth/ChangePasswordPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import PrinterList from '@/pages/inventory/PrinterList'
import PrinterDetail from '@/pages/inventory/PrinterDetail'
import WarehouseList from '@/pages/inventory/WarehouseList'
import WarehouseDetail from '@/pages/inventory/WarehouseDetail'
import ArticleList from '@/pages/inventory/ArticleList'
import ArticleDetail from '@/pages/inventory/ArticleDetail'
import InventoryMovementList from '@/pages/inventory/InventoryMovementList'
import ClientList from '@/pages/clients/ClientList'
import ClientDetail from '@/pages/clients/ClientDetail'
import ContractList from '@/pages/contracts/ContractList'
import ContractDetail from '@/pages/contracts/ContractDetail'
import CreateContract from '@/pages/contracts/CreateContract'
import CalendarPage from '@/pages/operations/CalendarPage'
import VisitDetailPage from '@/pages/operations/VisitDetailPage'
import ReadingListPage from '@/pages/operations/ReadingListPage'
import CaptureReadingPage from '@/pages/operations/CaptureReadingPage'
import InvoiceList from '@/pages/finance/InvoiceList'
import RegisterInvoicePage from '@/pages/finance/RegisterInvoicePage'
import RegisterPaymentPage from '@/pages/finance/RegisterPaymentPage'
import MaintenanceOrderList from '@/pages/maintenance/MaintenanceOrderList'
import MaintenanceOrderDetail from '@/pages/maintenance/MaintenanceOrderDetail'
import CreateMaintenanceOrder from '@/pages/maintenance/CreateMaintenanceOrder'
import RegisterExpensePage from '@/pages/maintenance/RegisterExpensePage'
import PurchaseList from '@/pages/purchases/PurchaseList'
import PurchaseDetail from '@/pages/purchases/PurchaseDetail'
import CreatePurchase from '@/pages/purchases/CreatePurchase'
import RegisterSupplierPayment from '@/pages/purchases/RegisterSupplierPayment'
import MaintenanceProviderReport from '@/pages/reports/MaintenanceProviderReport'
import ProblematicPrintersReport from '@/pages/reports/ProblematicPrintersReport'
import PrinterMaintenanceCostPage from '@/pages/reports/PrinterMaintenanceCostPage'
import ProfitabilityReport from '@/pages/reports/ProfitabilityReport'
import CashFlowReport from '@/pages/reports/CashFlowReport'
import BankAccountsPage from '@/pages/finance/BankAccountsPage'
import ReconciliationPage from '@/pages/finance/ReconciliationPage'
import ClosePeriodPage from '@/pages/finance/ClosePeriodPage'
import UserListPage from '@/pages/system/UserListPage'
import NotificationCenterPage from '@/pages/system/NotificationCenterPage'
import ConfigPage from '@/pages/system/ConfigPage'

function ProtectedRoute({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { isAuthenticated, isLoading, user } = useAuth()

  if (isLoading) return <LoadingSpinner />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (adminOnly && user?.rol !== UserRole.ADMIN) return <Navigate to="/" replace />

  return <>{children}</>
}

function LayoutWrapper({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { user, logout } = useAuth()

  return (
    <ProtectedRoute adminOnly={adminOnly}>
      <PageLayout user={user ?? undefined} onLogout={logout}>
        {children}
      </PageLayout>
    </ProtectedRoute>
  )
}

function RegisterPaymentPageRoute() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const navigate = useNavigate()

  return (
    <div className="py-8 max-w-lg mx-auto">
      <RegisterPaymentPage
        invoiceId={Number(invoiceId)}
        onClose={() => navigate('/facturas')}
      />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cambiar-contrasena" element={<ChangePasswordPage />} />

      <Route path="/" element={<LayoutWrapper><DashboardPage /></LayoutWrapper>} />

      <Route path="/impresoras" element={<LayoutWrapper><PrinterList /></LayoutWrapper>} />
      <Route path="/impresoras/:id" element={<LayoutWrapper><PrinterDetail /></LayoutWrapper>} />

      <Route path="/almacenes" element={<LayoutWrapper><WarehouseList /></LayoutWrapper>} />
      <Route path="/almacenes/:id" element={<LayoutWrapper><WarehouseDetail /></LayoutWrapper>} />

      <Route path="/articulos" element={<LayoutWrapper><ArticleList /></LayoutWrapper>} />
      <Route path="/articulos/:id" element={<LayoutWrapper><ArticleDetail /></LayoutWrapper>} />
      <Route path="/inventario/movimientos" element={<LayoutWrapper><InventoryMovementList /></LayoutWrapper>} />

      <Route path="/clientes" element={<LayoutWrapper><ClientList /></LayoutWrapper>} />
      <Route path="/clientes/:id" element={<LayoutWrapper><ClientDetail /></LayoutWrapper>} />

      <Route path="/contratos" element={<LayoutWrapper><ContractList /></LayoutWrapper>} />
      <Route path="/contratos/nuevo" element={<LayoutWrapper adminOnly><CreateContract /></LayoutWrapper>} />
      <Route path="/contratos/:id" element={<LayoutWrapper><ContractDetail /></LayoutWrapper>} />

      <Route path="/calendario" element={<LayoutWrapper><CalendarPage /></LayoutWrapper>} />
      <Route path="/visitas/:id" element={<LayoutWrapper><VisitDetailPage /></LayoutWrapper>} />

      <Route path="/lecturas" element={<LayoutWrapper><ReadingListPage /></LayoutWrapper>} />
      <Route path="/lecturas/captura" element={<LayoutWrapper><CaptureReadingPage /></LayoutWrapper>} />

      <Route path="/mantenimiento" element={<LayoutWrapper><MaintenanceOrderList /></LayoutWrapper>} />
      <Route path="/mantenimiento/nuevo" element={<LayoutWrapper adminOnly><CreateMaintenanceOrder /></LayoutWrapper>} />
      <Route path="/mantenimiento/:id" element={<LayoutWrapper><MaintenanceOrderDetail /></LayoutWrapper>} />
      <Route path="/gastos/registrar" element={<LayoutWrapper adminOnly><RegisterExpensePage /></LayoutWrapper>} />

      <Route path="/compras" element={<LayoutWrapper><PurchaseList /></LayoutWrapper>} />
      <Route path="/compras/nueva" element={<LayoutWrapper adminOnly><CreatePurchase /></LayoutWrapper>} />
      <Route path="/compras/:id" element={<LayoutWrapper><PurchaseDetail /></LayoutWrapper>} />
      <Route path="/pagos-proveedor/registrar" element={<LayoutWrapper adminOnly><RegisterSupplierPayment /></LayoutWrapper>} />

      <Route path="/reportes/mantenimiento/proveedores" element={<LayoutWrapper><MaintenanceProviderReport /></LayoutWrapper>} />
      <Route path="/reportes/mantenimiento/impresoras-problematicas" element={<LayoutWrapper><ProblematicPrintersReport /></LayoutWrapper>} />
      <Route path="/reportes/mantenimiento/costo-impresora" element={<LayoutWrapper><PrinterMaintenanceCostPage /></LayoutWrapper>} />
      <Route path="/reportes/rentabilidad" element={<LayoutWrapper><ProfitabilityReport /></LayoutWrapper>} />
      <Route path="/reportes/flujo-caja" element={<LayoutWrapper><CashFlowReport /></LayoutWrapper>} />

      <Route path="/facturas" element={<LayoutWrapper><InvoiceList /></LayoutWrapper>} />
      <Route path="/facturas/nueva" element={<LayoutWrapper><RegisterInvoicePage /></LayoutWrapper>} />
      <Route path="/pagos/registrar/:invoiceId" element={<LayoutWrapper><RegisterPaymentPageRoute /></LayoutWrapper>} />
      <Route path="/cuentas-bancarias" element={<LayoutWrapper><BankAccountsPage /></LayoutWrapper>} />
      <Route path="/conciliacion" element={<LayoutWrapper><ReconciliationPage /></LayoutWrapper>} />
      <Route path="/cierre-periodo" element={<LayoutWrapper adminOnly><ClosePeriodPage /></LayoutWrapper>} />

      <Route path="/usuarios" element={<LayoutWrapper adminOnly><UserListPage /></LayoutWrapper>} />
      <Route path="/notificaciones" element={<LayoutWrapper><NotificationCenterPage /></LayoutWrapper>} />
      <Route path="/configuracion" element={<LayoutWrapper><ConfigPage /></LayoutWrapper>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
