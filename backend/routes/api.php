<?php

use App\Http\Controllers\ArticleController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\BankAccountController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\CfdiController;
use App\Http\Controllers\ContractController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\FinanceReportController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\InventoryMovementController;
use App\Http\Controllers\MaintenanceOrderController;
use App\Http\Controllers\MaintenanceReportController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\PeriodController;
use App\Http\Controllers\PrinterBrandController;
use App\Http\Controllers\PrinterController;
use App\Http\Controllers\PrinterModelController;
use App\Http\Controllers\PurchaseController;
use App\Http\Controllers\ReadingController;
use App\Http\Controllers\ReconciliationController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\SupplierPaymentController;
use App\Http\Controllers\VisitController;
use App\Http\Controllers\WarehouseController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    Route::get('/auth/csrf', [AuthController::class, 'csrf']);
    Route::post('/auth/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/user', [AuthController::class, 'user']);

        // El dashboard no requiere permiso de acceso (sus widgets se filtran en UI).
        Route::get('dashboard', [DashboardController::class, 'index']);

        // =====================================================
        // Catálogo de marcas/modelos de impresora (lectura sin permiso)
        // =====================================================
        Route::get('printer-brands', [PrinterBrandController::class, 'index']);
        Route::get('printer-models', [PrinterModelController::class, 'index']);

        // =====================================================
        // Inventario
        // =====================================================
        Route::middleware('permission:inventario.impresoras')->group(function () {
            Route::apiResource('printers', PrinterController::class);
            Route::delete('printers/{printer}/force', [PrinterController::class, 'forceDelete']);
            Route::get('printers/{printer}/history', [PrinterController::class, 'history']);
            Route::get('printer-expenses', [ExpenseController::class, 'index']);
            Route::get('printer-expenses/{printerExpense}', [ExpenseController::class, 'show']);
            Route::post('printer-expenses', [ExpenseController::class, 'store']);

            // Creación de catálogo (solo admin con permiso de impresoras)
            Route::post('printer-brands', [PrinterBrandController::class, 'store']);
            Route::post('printer-models', [PrinterModelController::class, 'store']);
        });

        Route::middleware('permission:inventario.articulos')->group(function () {
            Route::apiResource('articles', ArticleController::class);
            Route::get('articles/{article}/movements', [ArticleController::class, 'movements']);
            Route::post('articles/{article}/movements', [ArticleController::class, 'storeMovement']);
            Route::get('articles/{article}/compatible-models', [ArticleController::class, 'compatibleModels']);
        });

        Route::middleware('permission:inventario.movimientos')->group(function () {
            Route::get('inventory-movements', [InventoryMovementController::class, 'index']);
            Route::get('inventory-movements/{inventoryMovement}', [InventoryMovementController::class, 'show']);
        });

        Route::middleware('permission:inventario.mantenimiento')->group(function () {
            Route::apiResource('maintenance-orders', MaintenanceOrderController::class);
            Route::post('maintenance-orders/{maintenanceOrder}/complete', [MaintenanceOrderController::class, 'complete']);
            Route::post('maintenance-orders/{maintenanceOrder}/cancel', [MaintenanceOrderController::class, 'cancel']);
            Route::post('maintenance-orders/{maintenanceOrder}/articles', [MaintenanceOrderController::class, 'addArticle']);
            Route::delete('maintenance-orders/{maintenanceOrder}/articles/{articleUsedId}', [MaintenanceOrderController::class, 'removeArticle']);
            Route::get('maintenance-orders/{maintenanceOrder}/articles', [MaintenanceOrderController::class, 'articles']);
            Route::get('reports/maintenance/problematic-printers', [MaintenanceReportController::class, 'problematicPrinters']);
            Route::get('reports/maintenance/printer/{printerId}/cost', [MaintenanceReportController::class, 'printerMaintenanceCost']);
        });

        Route::middleware('permission:inventario.almacenes')->group(function () {
            Route::apiResource('warehouses', WarehouseController::class);
            Route::post('warehouses/{warehouse}/deactivate', [WarehouseController::class, 'deactivate']);
            Route::get('warehouses/{warehouse}/printers', [WarehouseController::class, 'printers']);
        });

        // =====================================================
        // Clientes y Contratos
        // =====================================================
        Route::middleware('permission:clientes')->group(function () {
            Route::apiResource('clients', ClientController::class);
        });

        Route::middleware('permission:contratos')->group(function () {
            Route::apiResource('contracts', ContractController::class);
            Route::post('contracts/{contract}/assign-printer', [ContractController::class, 'assignPrinter']);
            Route::post('contracts/{contract}/release-printer', [ContractController::class, 'releasePrinter']);
        });

        // =====================================================
        // Operaciones
        // =====================================================
        Route::middleware('permission:operaciones.calendario')->group(function () {
            Route::get('visits/socios', [VisitController::class, 'socios']);
            Route::post('visits/generate', [VisitController::class, 'generate']);
            Route::apiResource('visits', VisitController::class);
            Route::post('visits/{visit}/complete', [VisitController::class, 'complete']);
            Route::post('visits/{visit}/reschedule', [VisitController::class, 'reschedule']);
        });

        Route::middleware('permission:operaciones.lecturas')->group(function () {
            Route::apiResource('readings', ReadingController::class)->only(['index', 'store', 'show']);
            Route::get('readings/visit/{visitId}', [ReadingController::class, 'getByVisit']);
            Route::get('readings/printer/{printerId}', [ReadingController::class, 'getByPrinter']);
        });

        // =====================================================
        // Finanzas
        // =====================================================
        Route::middleware('permission:finanzas.facturas')->group(function () {
            Route::get('invoices/calcular', [InvoiceController::class, 'calcular']);
            Route::apiResource('invoices', InvoiceController::class);
            Route::apiResource('payments', PaymentController::class)->only(['index', 'store']);
        });

        Route::middleware('permission:finanzas.cfdi')->group(function () {
            Route::post('cfdi/import', [CfdiController::class, 'import']);
            Route::post('cfdi/{cfdi}/factura', [CfdiController::class, 'generateInvoice']);
            Route::post('cfdi/{cfdi}/vincular', [CfdiController::class, 'link']);
            Route::delete('cfdi/{cfdi}/vincular', [CfdiController::class, 'unlink']);
            Route::patch('cfdi/{cfdi}', [CfdiController::class, 'update']);
            Route::apiResource('cfdi', CfdiController::class)->only(['index', 'show', 'destroy']);
        });

        Route::middleware('permission:finanzas.cuentas-por-pagar')->group(function () {
            Route::get('supplier-payments', [SupplierPaymentController::class, 'index']);
            Route::post('supplier-payments', [SupplierPaymentController::class, 'store']);
        });

        Route::middleware('permission:finanzas.compras')->group(function () {
            Route::apiResource('purchases', PurchaseController::class);
            Route::post('purchases/{purchase}/receive', [PurchaseController::class, 'receive']);
            Route::post('purchases/{purchase}/cancel', [PurchaseController::class, 'cancel']);
            Route::get('purchases/{purchase}/details', [PurchaseController::class, 'details']);
            Route::apiResource('suppliers', SupplierController::class)->only(['index', 'store', 'show', 'update']);
        });

        Route::middleware('permission:finanzas.rentabilidad')->group(function () {
            Route::get('reports/finance/profitability', [FinanceReportController::class, 'profitability']);
            Route::get('reports/finance/client-profitability', [FinanceReportController::class, 'clientProfitability']);
        });

        Route::middleware('permission:finanzas.flujo-caja')->group(function () {
            Route::get('reports/finance/cash-flow', [FinanceReportController::class, 'cashFlow']);
        });

        Route::middleware('permission:finanzas.cuentas-bancarias')->group(function () {
            Route::get('bank-accounts', [BankAccountController::class, 'index']);
            Route::post('bank-accounts', [BankAccountController::class, 'store']);
            Route::get('bank-accounts/{bankAccount}', [BankAccountController::class, 'show']);
            Route::put('bank-accounts/{bankAccount}', [BankAccountController::class, 'update']);
            Route::get('bank-accounts/{bankAccount}/movements', [BankAccountController::class, 'movements']);
        });

        Route::middleware('permission:finanzas.conciliacion')->group(function () {
            Route::get('reconciliation/{accountId}/movements', [ReconciliationController::class, 'movements']);
            Route::get('reconciliation/{accountId}/summary', [ReconciliationController::class, 'summary']);
            Route::post('reconciliation/link', [ReconciliationController::class, 'link']);
        });

        Route::middleware('permission:finanzas.cierre')->group(function () {
            Route::get('period/current', [PeriodController::class, 'current']);
            Route::get('period/history', [PeriodController::class, 'history']);
            Route::post('period/close', [PeriodController::class, 'close']);
        });

        // =====================================================
        // Sistema
        // =====================================================
        Route::middleware('permission:sistema.usuarios')->group(function () {
            Route::apiResource('users', UserController::class)->except(['destroy']);
            Route::post('users/{user}/reset-password', [UserController::class, 'resetPassword']);
            Route::get('audit-log', [AuditLogController::class, 'index']);
            Route::get('audit-log/{id}', [AuditLogController::class, 'show']);

            // Gestion de roles y catalogo de permisos
            Route::get('permisos', [PermissionController::class, 'index']);
            Route::apiResource('roles', RoleController::class);
        });

        Route::middleware('permission:sistema.notificaciones')->group(function () {
            Route::get('notifications', [NotificationController::class, 'index']);
            Route::post('notifications/{notification}/read', [NotificationController::class, 'markAsRead']);
            Route::post('notifications/read-all', [NotificationController::class, 'markAllAsRead']);
        });
    });
});
