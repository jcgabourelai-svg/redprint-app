import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from '@/pages/dashboard/Dashboard'
import PrinterList from '@/pages/inventory/printers/PrinterList'
import PrinterDetail from '@/pages/inventory/printers/PrinterDetail'
import ArticleList from '@/pages/inventory/articles/ArticleList'
import ArticleDetail from '@/pages/inventory/articles/ArticleDetail'
import MaintenanceList from '@/pages/inventory/maintenance/MaintenanceList'
import MaintenanceDetail from '@/pages/inventory/maintenance/MaintenanceDetail'
import CreateMaintenanceOrder from '@/pages/inventory/maintenance/CreateMaintenanceOrder'
import WarehouseList from '@/pages/inventory/warehouses/WarehouseList'
import WarehouseDetail from '@/pages/inventory/warehouses/WarehouseDetail'
import MovementList from '@/pages/inventory/movements/MovementList'
import ClientList from '@/pages/clients/ClientList'
import ClientDetail from '@/pages/clients/ClientDetail'
import ContractList from '@/pages/contracts/ContractList'
import ContractDetail from '@/pages/contracts/ContractDetail'
import CreateContract from '@/pages/contracts/CreateContract'
import CalendarPage from '@/pages/operations/calendar/CalendarPage'
import CaptureReadingPage from '@/pages/operations/readings/CaptureReadingPage'
import ReadingListPage from '@/pages/operations/readings/ReadingListPage'
import VisitDetailPage from '@/pages/operations/VisitDetailPage'
import InvoiceList from '@/pages/finance/invoices/InvoiceList'
import RegisterInvoicePage from '@/pages/finance/invoices/RegisterInvoicePage'
import PaymentList from '@/pages/finance/payments/PaymentList'
import ReceivablesList from '@/pages/finance/receivables/ReceivablesList'
import PurchaseList from '@/pages/finance/purchases/PurchaseList'
import PurchaseDetail from '@/pages/finance/purchases/PurchaseDetail'
import ProfitabilityReport from '@/pages/finance/reports/ProfitabilityReport'
import CashFlowReport from '@/pages/finance/reports/CashFlowReport'
import BankAccountsPage from '@/pages/finance/accounts/BankAccountsPage'
import ReconciliationPage from '@/pages/finance/accounts/ReconciliationPage'
import ClosePeriodPage from '@/pages/finance/period/ClosePeriodPage'
import UserListPage from '@/pages/admin/UserListPage'
import NotificationCenterPage from '@/pages/admin/NotificationCenterPage'
import ConfigPage from '@/pages/admin/ConfigPage'
import LoginPage from '@/pages/auth/LoginPage'
import ChangePasswordPage from '@/pages/auth/ChangePasswordPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route path="cambiar-contrasena" element={<ChangePasswordPage />} />
        <Route path="/">
          <Route index element={<Dashboard />} />
          <Route path="inventario/impresoras" element={<PrinterList />} />
          <Route path="inventario/impresoras/:id" element={<PrinterDetail />} />
          <Route path="inventario/articulos" element={<ArticleList />} />
          <Route path="inventario/articulos/:id" element={<ArticleDetail />} />
          <Route path="inventario/mantenimiento" element={<MaintenanceList />} />
          <Route path="inventario/mantenimiento/crear" element={<CreateMaintenanceOrder />} />
          <Route path="inventario/mantenimiento/:id" element={<MaintenanceDetail />} />
          <Route path="inventario/almacenes" element={<WarehouseList />} />
          <Route path="inventario/almacenes/:id" element={<WarehouseDetail />} />
          <Route path="inventario/movimientos" element={<MovementList />} />
          <Route path="clientes" element={<ClientList />} />
          <Route path="clientes/:id" element={<ClientDetail />} />
          <Route path="contratos" element={<ContractList />} />
          <Route path="contratos/crear" element={<CreateContract />} />
          <Route path="contratos/:id" element={<ContractDetail />} />
          <Route path="operaciones/calendario" element={<CalendarPage />} />
          <Route path="operaciones/visitas/:id" element={<VisitDetailPage />} />
          <Route path="operaciones/lecturas" element={<ReadingListPage />} />
          <Route path="operaciones/lecturas/:visitaId" element={<CaptureReadingPage />} />
          <Route path="finanzas/facturas" element={<InvoiceList />} />
          <Route path="finanzas/facturas/registrar" element={<RegisterInvoicePage />} />
          <Route path="finanzas/cuentas-por-cobrar" element={<ReceivablesList />} />
          <Route path="finanzas/cuentas-por-pagar" element={<PaymentList />} />
          <Route path="finanzas/compras" element={<PurchaseList />} />
          <Route path="finanzas/compras/:id" element={<PurchaseDetail />} />
          <Route path="finanzas/rentabilidad" element={<ProfitabilityReport />} />
          <Route path="finanzas/flujo-caja" element={<CashFlowReport />} />
          <Route path="finanzas/cuentas-bancarias" element={<BankAccountsPage />} />
          <Route path="finanzas/conciliacion" element={<ReconciliationPage />} />
          <Route path="finanzas/cierre" element={<ClosePeriodPage />} />
          <Route path="sistema/usuarios" element={<UserListPage />} />
          <Route path="sistema/notificaciones" element={<NotificationCenterPage />} />
          <Route path="sistema/configuracion" element={<ConfigPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
