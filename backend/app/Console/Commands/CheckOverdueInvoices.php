<?php

namespace App\Console\Commands;

use App\Services\InvoiceService;
use Illuminate\Console\Command;

class CheckOverdueInvoices extends Command
{
    protected $signature = 'invoices:check-overdue';

    protected $description = 'Marca como VENCIDA las facturas con saldo y fecha de vencimiento vencida';

    public function handle(InvoiceService $invoiceService): int
    {
        $this->info('Revisando facturas vencidas...');

        $marked = $invoiceService->checkOverdue();

        $this->info('Facturas marcadas como VENCIDA: ' . $marked);

        return self::SUCCESS;
    }
}
