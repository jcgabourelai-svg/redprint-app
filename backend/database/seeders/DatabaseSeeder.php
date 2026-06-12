<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            UserSeeder::class,
            WarehouseSeeder::class,
            SupplierSeeder::class,
            PrinterSeeder::class,
            ClientSeeder::class,
            ContractSeeder::class,
            VisitSeeder::class,
            ReadingSeeder::class,
            InvoiceSeeder::class,
            ArticleSeeder::class,
            InventoryMovementSeeder::class,
            MaintenanceOrderSeeder::class,
            PurchaseSeeder::class,
            SupplierPaymentSeeder::class,
            PrinterExpenseSeeder::class,
            BankAccountSeeder::class,
        ]);
    }
}
