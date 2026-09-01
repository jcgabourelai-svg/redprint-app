<?php

namespace Tests\Feature;

use App\Enums\ContractStatus;
use App\Enums\InvoiceStatus;
use App\Enums\MaintenanceStatus;
use App\Enums\MaintenanceType;
use App\Enums\PrinterStatus;
use App\Enums\VisitFrequency;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Invoice;
use App\Models\InvoiceDetail;
use App\Models\MaintenanceOrder;
use App\Models\Printer;
use App\Models\PrinterBrand;
use App\Models\PrinterExpense;
use App\Models\PrinterModel;
use App\Models\User;
use App\Services\ProfitabilityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProfitabilityServiceTest extends TestCase
{
    use RefreshDatabase;

    private function createUser(): User
    {
        return User::create([
            'nombre' => 'Socio Test',
            'correo' => 'socio@test.com',
            'contrasena_hash' => 'password',
            'telefono' => '555-0100',
            'activo' => true,
            'fecha_creacion' => now(),
        ]);
    }

    private function createClient(User $user): Client
    {
        return Client::create([
            'razon_social' => 'Cliente Test SA',
            'rfc' => 'CTS010101ABC',
            'nombre_contacto' => 'Contacto',
            'telefono' => '555-0200',
            'correo' => 'cliente@test.com',
            'direccion_instalacion' => 'Calle Falsa 123',
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);
    }

    private function createContract(Client $client, User $user): Contract
    {
        return Contract::create([
            'cliente_id' => $client->id,
            'codigo_negocio' => 'CTR-' . uniqid(),
            'fecha_inicio' => today(),
            'tarifa_base' => 1000,
            'paginas_incluidas' => 0,
            'costo_pag_excedente' => 0,
            'dias_gracia' => 0,
            'frecuencia_visitas' => VisitFrequency::MENSUAL,
            'dias_adelanto' => 0,
            'estado' => ContractStatus::ACTIVO,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);
    }

    private function createPrinter(User $user, float $costoAdquisicion): Printer
    {
        $brand = PrinterBrand::create([
            'nombre' => 'HP-' . uniqid(),
            'slug' => 'hp-' . uniqid(),
        ]);
        $model = PrinterModel::create([
            'brand_id' => $brand->id,
            'nombre' => 'LaserJet-' . uniqid(),
        ]);

        return Printer::create([
            'marca' => 'HP',
            'modelo' => 'LaserJet',
            'printer_model_id' => $model->id,
            'num_serie' => 'SN-' . uniqid(),
            'codigo_negocio' => 'IMP-' . uniqid(),
            'fecha_adquisicion' => today(),
            'costo_adquisicion' => $costoAdquisicion,
            'estado' => PrinterStatus::RENTADA,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);
    }

    private function attachPrinter(Contract $contract, Printer $printer): void
    {
        $contract->printers()->attach($printer->id, [
            'fecha_asignacion' => today(),
            'activa' => true,
            'lectura_inicial' => 0,
        ]);
    }

    public function test_per_printer_agrupa_ingresos_y_costos_correctamente(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);
        $contract = $this->createContract($client, $user);
        $printer = $this->createPrinter($user, 1000);
        $this->attachPrinter($contract, $printer);

        $inicio = now()->startOfMonth()->toDateString();
        $fin = now()->endOfMonth()->toDateString();

        $factura = Invoice::create([
            'numero_factura' => 'F-' . uniqid(),
            'cliente_id' => $client->id,
            'contrato_id' => $contract->id,
            'fecha_emision' => $inicio,
            'fecha_vencimiento' => $fin,
            'periodo_inicio' => $inicio,
            'periodo_fin' => $fin,
            'monto_total' => 3000,
            'monto_pagado' => 0,
            'saldo_pendiente' => 3000,
            'estado' => InvoiceStatus::PENDIENTE,
            'socio_id' => $user->id,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);

        // D19: los ingresos se atribuyen desde invoice_details (no desde el
        // encabezado); sin detalles la factura no atribuye ingresos.
        InvoiceDetail::create([
            'factura_id' => $factura->id,
            'contrato_id' => $contract->id,
            'impresora_id' => $printer->id,
            'lectura_id' => null,
            'paginas_consumidas' => 0,
            'monto_calculado' => 3000,
        ]);

        PrinterExpense::create([
            'impresora_id' => $printer->id,
            'tipo' => 'OTRO',
            'monto' => 400,
            'fecha' => $inicio,
            'descripcion' => 'tinta',
            'socio_id' => $user->id,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);

        MaintenanceOrder::create([
            'impresora_id' => $printer->id,
            'fecha' => $inicio,
            'tipo_mantto' => MaintenanceType::PREVENTIVO,
            'desc_problema' => 'preventivo',
            'costo_mano_obra' => 600,
            'costo_total' => 600,
            'socio_id' => $user->id,
            'estado' => MaintenanceStatus::COMPLETADA,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);

        $service = app(ProfitabilityService::class);
        $results = $service->perPrinter($inicio, $fin);

        $found = collect($results)->firstWhere('impresora_id', $printer->id);

        $this->assertNotNull($found, 'La impresora creada debe aparecer en el resultado agrupado');
        $this->assertEquals(3000.0, $found['ingresos']);
        $this->assertEquals(1000.0, $found['costos']);
        $this->assertEquals(2000.0, $found['margen']);
        $this->assertEquals(200.0, $found['roi']);
    }

    public function test_top_by_margin_ordena_por_margen_descendente(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);
        $contract = $this->createContract($client, $user);

        $inicio = now()->startOfMonth()->toDateString();
        $fin = now()->endOfMonth()->toDateString();

        $ganadora = $this->createPrinter($user, 1000);
        $perdedora = $this->createPrinter($user, 1000);
        $this->attachPrinter($contract, $ganadora);
        $this->attachPrinter($contract, $perdedora);

        Invoice::create([
            'numero_factura' => 'F-G-' . uniqid(),
            'cliente_id' => $client->id,
            'contrato_id' => $contract->id,
            'fecha_emision' => $inicio,
            'fecha_vencimiento' => $fin,
            'periodo_inicio' => $inicio,
            'periodo_fin' => $fin,
            'monto_total' => 5000,
            'monto_pagado' => 0,
            'saldo_pendiente' => 5000,
            'estado' => InvoiceStatus::PENDIENTE,
            'socio_id' => $user->id,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);

        MaintenanceOrder::create([
            'impresora_id' => $perdedora->id,
            'fecha' => $inicio,
            'tipo_mantto' => MaintenanceType::CORRECTIVO,
            'desc_problema' => 'falla',
            'costo_mano_obra' => 4000,
            'costo_total' => 4000,
            'socio_id' => $user->id,
            'estado' => MaintenanceStatus::COMPLETADA,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);

        $service = app(ProfitabilityService::class);
        $top = $service->topByMargin(5, $inicio, $fin);

        $this->assertSame($ganadora->id, $top[0]['impresora_id']);
        $this->assertGreaterThan($top[1]['margen'], $top[0]['margen']);
    }
}
