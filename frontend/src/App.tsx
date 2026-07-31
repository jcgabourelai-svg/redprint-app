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
import ReadingDetailPage from '@/pages/operations/readings/ReadingDetailPage'
import VisitDetailPage from '@/pages/operations/VisitDetailPage'
import InvoiceList from '@/pages/finance/invoices/InvoiceList'
import InvoiceDetail from '@/pages/finance/invoices/InvoiceDetail'
import RegisterInvoicePage from '@/pages/finance/invoices/RegisterInvoicePage'
import CfdiListPage from '@/pages/finance/cfdi/CfdiListPage'
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
import HelpPage from '@/pages/help/HelpPage'
import LoginPage from '@/pages/auth/LoginPage'
import ChangePasswordPage from '@/pages/auth/ChangePasswordPage'
import RequirePermission from '@/components/auth/RequirePermission'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route path="cambiar-contrasena" element={<ChangePasswordPage />} />
        <Route path="/">
          <Route index element={<Dashboard />} />
          <Route path="inventario/impresoras" element={<RequirePermission permiso="inventario.impresoras"><PrinterList /></RequirePermission>} />
          <Route path="inventario/impresoras/:id" element={<RequirePermission permiso="inventario.impresoras"><PrinterDetail /></RequirePermission>} />
          <Route path="inventario/articulos" element={<RequirePermission permiso="inventario.articulos"><ArticleList /></RequirePermission>} />
          <Route path="inventario/articulos/:id" element={<RequirePermission permiso="inventario.articulos"><ArticleDetail /></RequirePermission>} />
          <Route path="inventario/mantenimiento" element={<RequirePermission permiso="inventario.mantenimiento"><MaintenanceList /></RequirePermission>} />
          <Route path="inventario/mantenimiento/crear" element={<RequirePermission permiso="inventario.mantenimiento"><CreateMaintenanceOrder /></RequirePermission>} />
          <Route path="inventario/mantenimiento/:id" element={<RequirePermission permiso="inventario.mantenimiento"><MaintenanceDetail /></RequirePermission>} />
          <Route path="inventario/almacenes" element={<RequirePermission permiso="inventario.almacenes"><WarehouseList /></RequirePermission>} />
          <Route path="inventario/almacenes/:id" element={<RequirePermission permiso="inventario.almacenes"><WarehouseDetail /></RequirePermission>} />
          <Route path="inventario/movimientos" element={<RequirePermission permiso="inventario.movimientos"><MovementList /></RequirePermission>} />
          <Route path="clientes" element={<RequirePermission permiso="clientes"><ClientList /></RequirePermission>} />
          <Route path="clientes/:id" element={<RequirePermission permiso="clientes"><ClientDetail /></RequirePermission>} />
          <Route path="contratos" element={<RequirePermission permiso="contratos"><ContractList /></RequirePermission>} />
          <Route path="contratos/crear" element={<RequirePermission permiso="contratos"><CreateContract /></RequirePermission>} />
          <Route path="contratos/:id" element={<RequirePermission permiso="contratos"><ContractDetail /></RequirePermission>} />
          <Route path="operaciones/calendario" element={<Navigate to="/operaciones/visitas" replace />} />
          <Route path="operaciones/visitas" element={<RequirePermission permiso="operaciones.calendario"><CalendarPage /></RequirePermission>} />
          <Route path="operaciones/visitas/:id" element={<RequirePermission permiso="operaciones.calendario"><VisitDetailPage /></RequirePermission>} />
          <Route path="operaciones/lecturas" element={<RequirePermission permiso="operaciones.lecturas"><ReadingListPage /></RequirePermission>} />
          <Route path="operaciones/lecturas/detalle/:id" element={<RequirePermission permiso="operaciones.lecturas"><ReadingDetailPage /></RequirePermission>} />
          <Route path="operaciones/lecturas/:visitaId" element={<RequirePermission permiso="operaciones.lecturas"><CaptureReadingPage /></RequirePermission>} />
          <Route path="finanzas/facturas" element={<RequirePermission permiso="finanzas.facturas"><InvoiceList /></RequirePermission>} />
          <Route path="finanzas/facturas/registrar" element={<RequirePermission permiso="finanzas.facturas"><RegisterInvoicePage /></RequirePermission>} />
          <Route path="finanzas/facturas/:id" element={<RequirePermission permiso="finanzas.facturas"><InvoiceDetail /></RequirePermission>} />
          <Route path="finanzas/cfdi" element={<RequirePermission permiso="finanzas.cfdi"><CfdiListPage /></RequirePermission>} />
          <Route path="finanzas/cuentas-por-cobrar" element={<RequirePermission permiso="finanzas.cuentas-por-cobrar"><ReceivablesList /></RequirePermission>} />
          <Route path="finanzas/cuentas-por-pagar" element={<RequirePermission permiso="finanzas.cuentas-por-pagar"><PaymentList /></RequirePermission>} />
          <Route path="finanzas/compras" element={<RequirePermission permiso="finanzas.compras"><PurchaseList /></RequirePermission>} />
          <Route path="finanzas/compras/:id" element={<RequirePermission permiso="finanzas.compras"><PurchaseDetail /></RequirePermission>} />
          <Route path="finanzas/rentabilidad" element={<RequirePermission permiso="finanzas.rentabilidad"><ProfitabilityReport /></RequirePermission>} />
          <Route path="finanzas/flujo-caja" element={<RequirePermission permiso="finanzas.flujo-caja"><CashFlowReport /></RequirePermission>} />
          <Route path="finanzas/cuentas-bancarias" element={<RequirePermission permiso="finanzas.cuentas-bancarias"><BankAccountsPage /></RequirePermission>} />
          <Route path="finanzas/conciliacion" element={<RequirePermission permiso="finanzas.conciliacion"><ReconciliationPage /></RequirePermission>} />
          <Route path="finanzas/cierre" element={<RequirePermission permiso="finanzas.cierre"><ClosePeriodPage /></RequirePermission>} />
          <Route path="sistema/usuarios" element={<RequirePermission permiso="sistema.usuarios"><UserListPage /></RequirePermission>} />
          <Route path="sistema/notificaciones" element={<RequirePermission permiso="sistema.notificaciones"><NotificationCenterPage /></RequirePermission>} />
          <Route path="sistema/configuracion" element={<RequirePermission permiso="sistema.configuracion"><ConfigPage /></RequirePermission>} />
          <Route path="ayuda" element={<HelpPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
