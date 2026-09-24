<?php

namespace Tests\Feature;

use App\Enums\ContractStatus;
use App\Enums\InvoiceStatus;
use App\Enums\MaintenanceStatus;
use App\Enums\MaintenanceType;
use App\Enums\PrinterStatus;
use App\Enums\VisitFrequency;
use App\Enums\VisitStatus;
use App\Models\Article;
use App\Models\ArticleDelivery;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Invoice;
use App\Models\InvoiceDetail;
use App\Models\MaintenanceOrder;
use App\Models\Printer;
use App\Models\PrinterBrand;
use App\Models\PrinterExpense;
use App\Models\PrinterModel;
use App\Models\Reading;
use App\Models\User;
use App\Models\Visit;
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

    private function articulo(string $subtipo): Article
    {
        return Article::create([
            'tipo_articulo' => 'CONSUMIBLE',
            'subtipo' => $subtipo,
            'nombre' => 'Artículo ' . $subtipo . ' ' . uniqid(),
            'marca' => 'HP',
            'modelo_sku' => 'SKU-' . uniqid(),
            'stock_actual' => 10,
            'umbral_reposicion' => 3,
            'costo_unitario' => 100,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);
    }

    private function entregaToner(Contract $contract, User $user, Article $articulo, int $cantidad, float $costoUnitario, ?string $fecha = null): ArticleDelivery
    {
        $fecha ??= today()->setTime(12, 0)->toDateTimeString();

        $visita = Visit::create([
            'cliente_id' => $contract->cliente_id,
            'contrato_id' => $contract->id,
            'tipo_visita' => 'ENTREGA_INSUMOS',
            'fecha_programada' => substr($fecha, 0, 10),
            'socio_id' => $user->id,
            'estado' => VisitStatus::COMPLETADA,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);

        return ArticleDelivery::create([
            'articulo_id' => $articulo->id,
            'visita_id' => $visita->id,
            'contrato_id' => $contract->id,
            'cliente_id' => $contract->cliente_id,
            'cantidad' => $cantidad,
            'costo_unitario' => $costoUnitario,
            'subtotal' => $cantidad * $costoUnitario,
            'socio_id' => $user->id,
            'fecha_creacion' => $fecha,
        ]);
    }

    private function lectura(Contract $contract, User $user, Printer $printer, string $fecha, int $contador, ?array $niveles = null, int $paginas = 0): Reading
    {
        $visita = Visit::create([
            'cliente_id' => $contract->cliente_id,
            'contrato_id' => $contract->id,
            'tipo_visita' => 'LECTURA',
            'fecha_programada' => $fecha,
            'socio_id' => $user->id,
            'estado' => VisitStatus::COMPLETADA,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);

        return Reading::create([
            'visita_id' => $visita->id,
            'impresora_id' => $printer->id,
            'contrato_id' => $contract->id,
            'fecha' => $fecha,
            'valor_contador' => $contador,
            'paginas_periodo' => $paginas,
            'niveles_toner' => $niveles,
            'socio_id' => $user->id,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
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

    public function test_insumos_toner_completos_en_contrato_de_una_impresora(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);
        $contract = $this->createContract($client, $user);
        $printer = $this->createPrinter($user, 1000);
        $this->attachPrinter($contract, $printer);

        $inicio = now()->startOfMonth()->toDateString();
        $fin = now()->endOfMonth()->toDateString();

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

        $this->entregaToner($contract, $user, $this->articulo('TONER'), 2, 250.0);

        $service = app(ProfitabilityService::class);
        $found = collect($service->perPrinter($inicio, $fin))->firstWhere('impresora_id', $printer->id);

        $this->assertNotNull($found);
        $this->assertEquals(400.0, $found['gastos']);
        $this->assertEquals(0.0, $found['mantenimiento']);
        $this->assertEquals(500.0, $found['insumos_toner']);
        $this->assertEquals(900.0, $found['costos']);
        $this->assertEquals(-900.0, $found['margen']);
    }

    public function test_insumos_toner_reparte_parejo_entre_impresoras_activas(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);
        $contract = $this->createContract($client, $user);
        $printerA = $this->createPrinter($user, 1000);
        $printerB = $this->createPrinter($user, 1000);
        $this->attachPrinter($contract, $printerA);
        $this->attachPrinter($contract, $printerB);

        $inicio = now()->startOfMonth()->toDateString();
        $fin = now()->endOfMonth()->toDateString();

        $this->entregaToner($contract, $user, $this->articulo('TONER'), 3, 200.0);

        $service = app(ProfitabilityService::class);
        $results = $service->perPrinter($inicio, $fin);

        $rowA = collect($results)->firstWhere('impresora_id', $printerA->id);
        $rowB = collect($results)->firstWhere('impresora_id', $printerB->id);

        // Reparto parejo por renglón...
        $this->assertEquals(300.0, $rowA['insumos_toner']);
        $this->assertEquals(300.0, $rowB['insumos_toner']);

        // ...y exacto a nivel cliente (la entrega vive a nivel contrato):
        // el controlador suma las filas de costByPrinter de las activas.
        $porImpresora = $service->costByPrinter([$printerA->id, $printerB->id], $inicio, $fin);
        $totalCliente = array_sum(array_column($porImpresora, 'insumos_toner'));
        $this->assertEquals(600.0, $totalCliente);
    }

    public function test_insumos_toner_ignora_entregas_de_articulos_no_toner(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);
        $contract = $this->createContract($client, $user);
        $printer = $this->createPrinter($user, 1000);
        $this->attachPrinter($contract, $printer);

        $inicio = now()->startOfMonth()->toDateString();
        $fin = now()->endOfMonth()->toDateString();

        $this->entregaToner($contract, $user, $this->articulo('TAMBOR'), 5, 100.0);

        $service = app(ProfitabilityService::class);
        $found = collect($service->perPrinter($inicio, $fin))->firstWhere('impresora_id', $printer->id);

        $this->assertEquals(0.0, $found['insumos_toner']);
        $this->assertEquals(0.0, $found['costos']);
    }

    public function test_insumos_toner_ignora_entregas_fuera_del_rango(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);
        $contract = $this->createContract($client, $user);
        $printer = $this->createPrinter($user, 1000);
        $this->attachPrinter($contract, $printer);

        $inicio = now()->startOfMonth()->toDateString();
        $fin = now()->endOfMonth()->toDateString();

        // Entrega del mes anterior: fuera del periodo del reporte.
        $fueraDeRango = now()->startOfMonth()->subDays(5)->setTime(12, 0)->toDateTimeString();
        $this->entregaToner($contract, $user, $this->articulo('TONER'), 2, 250.0, $fueraDeRango);

        $service = app(ProfitabilityService::class);
        $found = collect($service->perPrinter($inicio, $fin))->firstWhere('impresora_id', $printer->id);

        $this->assertEquals(0.0, $found['insumos_toner']);
    }

    public function test_paginas_periodo_suma_lecturas_del_rango(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);
        $contract = $this->createContract($client, $user);
        $printer = $this->createPrinter($user, 1000);
        $this->attachPrinter($contract, $printer);

        $inicio = now()->startOfMonth()->toDateString();
        $fin = now()->endOfMonth()->toDateString();

        $this->lectura($contract, $user, $printer, today()->subDays(2)->toDateString(), 1200, paginas: 100);
        $this->lectura($contract, $user, $printer, today()->toDateString(), 1400, paginas: 40);
        // Fuera del rango: no suma.
        $this->lectura($contract, $user, $printer, now()->startOfMonth()->subDays(10)->toDateString(), 1100, paginas: 500);

        $service = app(ProfitabilityService::class);
        $found = collect($service->perPrinter($inicio, $fin))->firstWhere('impresora_id', $printer->id);

        $this->assertSame(140, $found['paginas_periodo']);
    }

    public function test_costo_toner_por_pagina_null_sin_niveles_y_valor_con_rendimiento(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);
        $contractA = $this->createContract($client, $user);
        $printerSinNiveles = $this->createPrinter($user, 1000);
        $this->attachPrinter($contractA, $printerSinNiveles);

        // Promedio ponderado: (1×100 + 3×200) ÷ 4 = 175.
        $this->entregaToner($contractA, $user, $this->articulo('TONER'), 1, 100.0);
        $this->entregaToner($contractA, $user, $this->articulo('TONER'), 3, 200.0);

        $contractB = $this->createContract($client, $user);
        $printerConNiveles = $this->createPrinter($user, 1000);
        $this->attachPrinter($contractB, $printerConNiveles);

        $this->entregaToner($contractB, $user, $this->articulo('TONER'), 1, 100.0);
        $this->entregaToner($contractB, $user, $this->articulo('TONER'), 3, 200.0);

        // Tramos entre resets (patrón TonerServiceTest): 2.900 y 3.000 ⇒
        // mediana 2.950. (createPrinter genera un modelo único por impresora.)
        $this->lectura($contractB, $user, $printerConNiveles, today()->subDays(40)->toDateString(), 10000, ['k' => 80]);
        $this->lectura($contractB, $user, $printerConNiveles, today()->subDays(20)->toDateString(), 12900, ['k' => 10]);
        $this->lectura($contractB, $user, $printerConNiveles, today()->subDays(19)->toDateString(), 13000, ['k' => 100]);
        $this->lectura($contractB, $user, $printerConNiveles, today()->toDateString(), 16000, ['k' => 15]);

        $inicio = now()->startOfMonth()->toDateString();
        $fin = now()->endOfMonth()->toDateString();

        $service = app(ProfitabilityService::class);
        $results = collect($service->perPrinter($inicio, $fin));

        // Sin niveles capturados no hay rendimiento ⇒ nunca inventar.
        $this->assertNull($results->firstWhere('impresora_id', $printerSinNiveles->id)['costo_toner_por_pagina']);

        // Con rendimiento: 175 ÷ 2.950 ≈ 0,0593 por página.
        $conNiveles = $results->firstWhere('impresora_id', $printerConNiveles->id);
        $this->assertEqualsWithDelta(175 / 2950, $conNiveles['costo_toner_por_pagina'], 0.000001);
    }

    public function test_entregas_de_contrato_sin_pivotes_activos_no_atribuyen(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);
        $contract = $this->createContract($client, $user);
        $printer = $this->createPrinter($user, 1000);

        // Pivot inactiva (impresora liberada): mismo filtro que la atribución
        // de ingresos D19 — la entrega queda fuera de ambos reportes.
        $contract->printers()->attach($printer->id, [
            'fecha_asignacion' => today(),
            'activa' => false,
            'lectura_inicial' => 0,
        ]);

        $inicio = now()->startOfMonth()->toDateString();
        $fin = now()->endOfMonth()->toDateString();

        $this->entregaToner($contract, $user, $this->articulo('TONER'), 2, 250.0);

        $service = app(ProfitabilityService::class);
        $found = collect($service->perPrinter($inicio, $fin))->firstWhere('impresora_id', $printer->id);

        $this->assertEquals(0.0, $found['insumos_toner']);
        $this->assertEquals(0.0, $found['costos']);
    }
}
