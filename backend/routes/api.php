<?php

use App\Http\Controllers\ArticleController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\BankAccountController;
use App\Http\Controllers\ClientController;
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
use App\Http\Controllers\PeriodController;
use App\Http\Controllers\PrinterController;
use App\Http\Controllers\PurchaseController;
use App\Http\Controllers\ReadingController;
use App\Http\Controllers\ReconciliationController;
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

        Route::middleware('role:ADMIN')->group(function () {
            Route::apiResource('users', UserController::class)->except(['destroy']);
            Route::post('users/{user}/reset-password', [UserController::class, 'resetPassword']);
            Route::post('suppliers', [SupplierController::class, 'store']);
            Route::post('warehouses', [WarehouseController::class, 'store']);
            Route::post('printers', [PrinterController::class, 'store']);
        });

        Route::get('users', [UserController::class, 'index'])->middleware('role:ADMIN');

        Route::apiResource('printers', PrinterController::class)->except(['store', 'destroy']);
        Route::delete('printers/{printer}', [PrinterController::class, 'destroy'])->middleware('role:ADMIN');
        Route::get('printers/{printer}/history', [PrinterController::class, 'history']);

        Route::get('warehouses', [WarehouseController::class, 'index']);
        Route::get('warehouses/{warehouse}', [WarehouseController::class, 'show']);
        Route::put('warehouses/{warehouse}', [WarehouseController::class, 'update']);
        Route::post('warehouses/{warehouse}/deactivate', [WarehouseController::class, 'deactivate']);
        Route::get('warehouses/{warehouse}/printers', [WarehouseController::class, 'printers']);

        Route::apiResource('clients', ClientController::class);

        Route::apiResource('contracts', ContractController::class);
        Route::post('contracts/{contract}/assign-printer', [ContractController::class, 'assignPrinter']);
        Route::post('contracts/{contract}/release-printer', [ContractController::class, 'releasePrinter']);

        Route::apiResource('visits', VisitController::class);
        Route::post('visits/{visit}/complete', [VisitController::class, 'complete']);
        Route::post('visits/{visit}/reschedule', [VisitController::class, 'reschedule']);

        Route::apiResource('readings', ReadingController::class)->only(['index', 'store']);
        Route::get('readings/visit/{visitId}', [ReadingController::class, 'getByVisit']);
        Route::get('readings/printer/{printerId}', [ReadingController::class, 'getByPrinter']);

        Route::apiResource('invoices', InvoiceController::class);
        Route::apiResource('payments', PaymentController::class)->only(['index', 'store']);

        Route::get('suppliers', [SupplierController::class, 'index']);
        Route::get('suppliers/{supplier}', [SupplierController::class, 'show']);
        Route::put('suppliers/{supplier}', [SupplierController::class, 'update']);

        Route::apiResource('articles', ArticleController::class);
        Route::get('articles/{article}/movements', [ArticleController::class, 'movements']);
        Route::get('articles/{article}/compatible-printers', [ArticleController::class, 'compatiblePrinters']);

        Route::get('inventory-movements', [InventoryMovementController::class, 'index']);
        Route::get('inventory-movements/{inventoryMovement}', [InventoryMovementController::class, 'show']);

        Route::apiResource('maintenance-orders', MaintenanceOrderController::class);
        Route::post('maintenance-orders/{maintenanceOrder}/complete', [MaintenanceOrderController::class, 'complete']);
        Route::post('maintenance-orders/{maintenanceOrder}/cancel', [MaintenanceOrderController::class, 'cancel']);
        Route::post('maintenance-orders/{maintenanceOrder}/articles', [MaintenanceOrderController::class, 'addArticle']);
        Route::delete('maintenance-orders/{maintenanceOrder}/articles/{articleUsedId}', [MaintenanceOrderController::class, 'removeArticle']);
        Route::get('maintenance-orders/{maintenanceOrder}/articles', [MaintenanceOrderController::class, 'articles']);

        Route::get('printer-expenses', [ExpenseController::class, 'index']);
        Route::get('printer-expenses/{printerExpense}', [ExpenseController::class, 'show']);
        Route::post('printer-expenses', [ExpenseController::class, 'store']);

        Route::apiResource('purchases', PurchaseController::class);
        Route::post('purchases/{purchase}/receive', [PurchaseController::class, 'receive']);
        Route::post('purchases/{purchase}/cancel', [PurchaseController::class, 'cancel']);
        Route::get('purchases/{purchase}/details', [PurchaseController::class, 'details']);

        Route::get('supplier-payments', [SupplierPaymentController::class, 'index']);
        Route::post('supplier-payments', [SupplierPaymentController::class, 'store']);

        Route::get('reports/maintenance/providers', [MaintenanceReportController::class, 'providerMetrics']);
        Route::get('reports/maintenance/problematic-printers', [MaintenanceReportController::class, 'problematicPrinters']);
        Route::get('reports/maintenance/printer/{printerId}/cost', [MaintenanceReportController::class, 'printerMaintenanceCost']);

        Route::get('notifications', [NotificationController::class, 'index']);
        Route::post('notifications/{notification}/read', [NotificationController::class, 'markAsRead']);
        Route::post('notifications/read-all', [NotificationController::class, 'markAllAsRead']);

        Route::get('audit-log', [AuditLogController::class, 'index']);
        Route::get('audit-log/{id}', [AuditLogController::class, 'show']);

        Route::get('bank-accounts', [BankAccountController::class, 'index']);
        Route::post('bank-accounts', [BankAccountController::class, 'store']);
        Route::get('bank-accounts/{bankAccount}', [BankAccountController::class, 'show']);
        Route::put('bank-accounts/{bankAccount}', [BankAccountController::class, 'update']);
        Route::get('bank-accounts/{bankAccount}/movements', [BankAccountController::class, 'movements']);

        Route::get('period/current', [PeriodController::class, 'current']);
        Route::get('period/history', [PeriodController::class, 'history']);
        Route::post('period/close', [PeriodController::class, 'close']);

        Route::get('reports/finance/profitability', [FinanceReportController::class, 'profitability']);
        Route::get('reports/finance/client-profitability', [FinanceReportController::class, 'clientProfitability']);
        Route::get('reports/finance/cash-flow', [FinanceReportController::class, 'cashFlow']);

        Route::get('reconciliation/{accountId}/movements', [ReconciliationController::class, 'movements']);
        Route::get('reconciliation/{accountId}/summary', [ReconciliationController::class, 'summary']);
        Route::post('reconciliation/link', [ReconciliationController::class, 'link']);

        Route::get('dashboard', [DashboardController::class, 'index']);
    });
});
