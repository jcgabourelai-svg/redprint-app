<?php

namespace Tests\Feature;

use App\Enums\ContractStatus;
use App\Enums\PrinterStatus;
use App\Enums\VisitFrequency;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Invoice;
use App\Models\InvoiceDetail;
use App\Models\Printer;
use App\Models\PrinterBrand;
use App\Models\PrinterModel;
use App\Models\Reading;
use App\Models\User;
use App\Models\Visit;
use App\Exceptions\BusinessRuleException;
use App\Services\InvoiceCalculationService;
use App\Services\InvoiceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvoiceCalculationTest extends TestCase
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

    private function createContract(Client $client, User $user, array $overrides = []): Contract
    {
        return Contract::create(array_merge([
            'cliente_id' => $client->id,
            'codigo_negocio' => 'CTR-TEST',
            'fecha_inicio' => today(),
            'tarifa_base' => 1500,
            'paginas_incluidas' => 500,
            'costo_pag_excedente' => 0.01,
            'dias_gracia' => 15,
            'frecuencia_visitas' => VisitFrequency::MENSUAL,
            'dias_adelanto' => 7,
            'estado' => ContractStatus::ACTIVO,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ], $overrides));
    }

    private function createPrinter(User $user): Printer
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
            'estado' => PrinterStatus::RENTADA,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);
    }

    private function attachPrinter(Contract $contract, Printer $printer): void
    {
        $contract->printers()->attach($printer->id, [
            // Ventana que arranca antes que las lecturas del fixture (junio):
            // el motor de facturación filtra por intersección de ventanas.
            'fecha_asignacion' => '2026-06-01',
            'activa' => true,
            'lectura_inicial' => 0,
        ]);
    }

    private function createReading(Contract $contract, Printer $printer, User $user, string $fecha, int $paginas): Reading
    {
        $visit = Visit::create([
            'cliente_id' => $contract->cliente_id,
            'contrato_id' => $contract->id,
            'tipo_visita' => 'LECTURA',
            'fecha_programada' => $fecha,
            'socio_id' => $user->id,
            'estado' => 'COMPLETADA',
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);

        return Reading::create([
            'visita_id' => $visit->id,
            'impresora_id' => $printer->id,
            'contrato_id' => $contract->id,
            'fecha' => $fecha,
            'valor_contador' => $paginas,
            'paginas_periodo' => $paginas,
            'socio_id' => $user->id,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);
    }

    public function test_calcula_monto_desde_lecturas_y_detalles_suman_exacto(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);
        $contract = $this->createContract($client, $user);
        $printer = $this->createPrinter($user);
        $this->attachPrinter($contract, $printer);

        // 700 paginas -> excedente 200 -> 1500 + 200*0.01 = 1502
        $this->createReading($contract, $printer, $user, '2026-06-05', 700);

        $service = app(InvoiceCalculationService::class);
        $result = $service->calcularEstimacion($client->id, '2026-06-01', '2026-06-30');

        $this->assertEquals(1502.0, $result['monto_total']);
        $this->assertCount(1, $result['detalles']);
        $this->assertEquals(
            round(array_sum(array_column($result['detalles'], 'monto_calculado')), 2),
            $result['monto_total']
        );
    }

    public function test_excluye_lecturas_ya_facturadas(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);
        $contract = $this->createContract($client, $user);
        $printer = $this->createPrinter($user);
        $this->attachPrinter($contract, $printer);

        $reading = $this->createReading($contract, $printer, $user, '2026-06-05', 700);

        // Simular que la lectura ya fue facturada.
        $invoice = Invoice::create([
            'numero_factura' => 'F-EXIST-' . uniqid(),
            'cliente_id' => $client->id,
            'fecha_emision' => '2026-06-10',
            'fecha_vencimiento' => '2026-07-10',
            'monto_total' => 1502,
            'monto_pagado' => 0,
            'saldo_pendiente' => 1502,
            'estado' => 'PENDIENTE',
            'socio_id' => $user->id,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);
        InvoiceDetail::create([
            'factura_id' => $invoice->id,
            'contrato_id' => $contract->id,
            'impresora_id' => $printer->id,
            'lectura_id' => $reading->id,
            'paginas_consumidas' => 700,
            'monto_calculado' => 1502,
        ]);

        $service = app(InvoiceCalculationService::class);
        $result = $service->calcularEstimacion($client->id, '2026-06-01', '2026-06-30');

        // Sin lecturas, tarifa_base como renta base -> 1500.
        $this->assertEquals(1500.0, $result['monto_total']);
        $this->assertEmpty($result['detalles'] === [] ? [] : array_filter(
            $result['detalles'],
            fn ($d) => $d['lectura_id'] === $reading->id
        ));
    }

    public function test_lectura_sin_contrato_va_a_advertencias(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);
        $contract = $this->createContract($client, $user, ['tarifa_base' => 0]);
        $printer = $this->createPrinter($user);
        $this->attachPrinter($contract, $printer);

        $visit = Visit::create([
            'cliente_id' => $client->id,
            'contrato_id' => null,
            'tipo_visita' => 'LECTURA',
            'fecha_programada' => '2026-06-05',
            'socio_id' => $user->id,
            'estado' => 'COMPLETADA',
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);
        Reading::create([
            'visita_id' => $visit->id,
            'impresora_id' => $printer->id,
            'contrato_id' => null,
            'fecha' => '2026-06-05',
            'valor_contador' => 300,
            'paginas_periodo' => 300,
            'socio_id' => $user->id,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);

        $service = app(InvoiceCalculationService::class);
        $result = $service->calcularEstimacion($client->id, '2026-06-01', '2026-06-30');

        $this->assertEquals(0.0, $result['monto_total']);
        $this->assertNotEmpty($result['advertencias']);
        $this->assertTrue(
            collect($result['advertencias'])->contains(fn ($a) => str_contains($a, 'no tiene contrato'))
        );
    }

    public function test_cliente_sin_contratos_activos_devuelve_cero_y_advertencia(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);

        $service = app(InvoiceCalculationService::class);
        $result = $service->calcularEstimacion($client->id, '2026-06-01', '2026-06-30');

        $this->assertEquals(0.0, $result['monto_total']);
        $this->assertEmpty($result['detalles']);
        $this->assertNotEmpty($result['advertencias']);
    }

    public function test_periodo_multi_mes_agrega_advertencia_de_renta(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);
        $contract = $this->createContract($client, $user);
        $printer = $this->createPrinter($user);
        $this->attachPrinter($contract, $printer);
        $this->createReading($contract, $printer, $user, '2026-06-05', 700);

        $service = app(InvoiceCalculationService::class);
        $result = $service->calcularEstimacion($client->id, '2026-06-01', '2026-07-31');

        // Tarifa base y paginas incluidas se cobran una sola vez: 2 meses en
        // una sola factura subcobrarian la renta del segundo mes.
        $this->assertTrue(
            collect($result['advertencias'])->contains(
                fn ($a) => str_contains($a, 'la tarifa base y las páginas incluidas se aplican una sola vez por factura')
            )
        );
    }

    public function test_periodo_de_un_mes_calendario_no_agrega_advertencia_multi_mes(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);
        $contract = $this->createContract($client, $user);
        $printer = $this->createPrinter($user);
        $this->attachPrinter($contract, $printer);
        $this->createReading($contract, $printer, $user, '2026-06-05', 700);

        $service = app(InvoiceCalculationService::class);

        // Mes calendario completo...
        $result = $service->calcularEstimacion($client->id, '2026-06-01', '2026-06-30');
        $this->assertFalse(
            collect($result['advertencias'])->contains(
                fn ($a) => str_contains($a, 'se aplican una sola vez por factura')
            )
        );

        // ...y un rango de 31 dias exactos (jul 1 -> ago 1): ~1.0 mes, sin aviso.
        $result = $service->calcularEstimacion($client->id, '2026-07-01', '2026-08-01');
        $this->assertFalse(
            collect($result['advertencias'])->contains(
                fn ($a) => str_contains($a, 'se aplican una sola vez por factura')
            )
        );
    }

    public function test_varios_contratos_suma_detalles_igual_monto_total(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);

        // Contrato A: tarifa_base 1000, 0 incluidas, costo 0.0125 -> 300 pag -> 1000 + 300*0.0125 = 1003.75
        $contractA = $this->createContract($client, $user, [
            'codigo_negocio' => 'CTR-A-' . uniqid(),
            'tarifa_base' => 1000,
            'paginas_incluidas' => 0,
            'costo_pag_excedente' => 0.0125,
        ]);
        $printerA = $this->createPrinter($user);
        $this->attachPrinter($contractA, $printerA);
        $this->createReading($contractA, $printerA, $user, '2026-06-05', 300);

        // Contrato B: tarifa_base 500, costo 0.015 -> 200 pag -> 500 + 200*0.015 = 503
        $contractB = $this->createContract($client, $user, [
            'codigo_negocio' => 'CTR-B-' . uniqid(),
            'tarifa_base' => 500,
            'paginas_incluidas' => 0,
            'costo_pag_excedente' => 0.015,
        ]);
        $printerB = $this->createPrinter($user);
        $this->attachPrinter($contractB, $printerB);
        $this->createReading($contractB, $printerB, $user, '2026-06-06', 200);

        $service = app(InvoiceCalculationService::class);
        $result = $service->calcularEstimacion($client->id, '2026-06-01', '2026-06-30');

        $sumaDetalles = round(array_sum(array_column($result['detalles'], 'monto_calculado')), 2);
        $this->assertEquals($result['monto_total'], $sumaDetalles);
        $this->assertEquals(1506.75, $result['monto_total']);
    }

    public function test_lectura_cero_paginas_se_vincula_y_no_se_repite(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);
        $contract = $this->createContract($client, $user, ['tarifa_base' => 800]);
        $printer = $this->createPrinter($user);
        $this->attachPrinter($contract, $printer);

        $reading = $this->createReading($contract, $printer, $user, '2026-06-05', 0);

        $service = app(InvoiceCalculationService::class);
        $result = $service->calcularEstimacion($client->id, '2026-06-01', '2026-06-30');

        // La renta base (800) cae en la fila vinculada a la lectura.
        $this->assertEquals(800.0, $result['monto_total']);
        $detalle = collect($result['detalles'])->firstWhere('lectura_id', $reading->id);
        $this->assertNotNull($detalle, 'La lectura de 0 paginas debe quedar vinculada en detalles');

        // Al facturar esa lectura, una segunda estimacion la excluye (monto 0).
        Invoice::create([
            'numero_factura' => 'F-ZERO-' . uniqid(),
            'cliente_id' => $client->id,
            'fecha_emision' => '2026-06-10',
            'fecha_vencimiento' => '2026-07-10',
            'monto_total' => 800,
            'monto_pagado' => 0,
            'saldo_pendiente' => 800,
            'estado' => 'PENDIENTE',
            'socio_id' => $user->id,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);
        InvoiceDetail::create([
            'factura_id' => Invoice::latest('id')->value('id'),
            'contrato_id' => $contract->id,
            'impresora_id' => $printer->id,
            'lectura_id' => $reading->id,
            'paginas_consumidas' => 0,
            'monto_calculado' => 800,
        ]);

        $result2 = $service->calcularEstimacion($client->id, '2026-06-01', '2026-06-30');
        // La lectura ya no se vuelve a seleccionar (no se duplica). El contrato
        // sigue cobrando renta base (800) al no quedar lecturas, pero la
        // lectura consumida no aparece de nuevo en detalles.
        $this->assertNull(
            collect($result2['detalles'])->firstWhere('lectura_id', $reading->id),
            'La lectura ya facturada no debe volver a seleccionarse'
        );
    }

    public function test_lectura_de_contrato_no_activo_se_advierte_y_no_se_factura(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);
        // Contrato activo (tarifa_base 0 para aislar el comportamiento del
        // contrato inactivo); su impresora compartida esta en el set activo.
        $active = $this->createContract($client, $user, [
            'codigo_negocio' => 'CTR-ON-' . uniqid(),
            'tarifa_base' => 0,
        ]);
        $printer = $this->createPrinter($user);
        $this->attachPrinter($active, $printer);

        // Contrato inactivo; la lectura se liga a el (no al activo) pero usa la
        // impresora activa -> se recupera, pero su contrato no esta activo.
        $inactive = $this->createContract($client, $user, [
            'codigo_negocio' => 'CTR-OFF-' . uniqid(),
            'estado' => ContractStatus::SUSPENDIDO,
        ]);
        $visit = Visit::create([
            'cliente_id' => $client->id,
            'contrato_id' => $inactive->id,
            'tipo_visita' => 'LECTURA',
            'fecha_programada' => '2026-06-05',
            'socio_id' => $user->id,
            'estado' => 'COMPLETADA',
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);
        Reading::create([
            'visita_id' => $visit->id,
            'impresora_id' => $printer->id,
            'contrato_id' => $inactive->id,
            'fecha' => '2026-06-05',
            'valor_contador' => 500,
            'paginas_periodo' => 500,
            'socio_id' => $user->id,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);

        $service = app(InvoiceCalculationService::class);
        $result = $service->calcularEstimacion($client->id, '2026-06-01', '2026-06-30');

        $this->assertEquals(0.0, $result['monto_total']);
        $this->assertTrue(
            collect($result['advertencias'])->contains(fn ($a) => str_contains($a, 'no esta activo'))
        );
    }

    /**
     * Retiro a mitad de periodo con lectura de cierre: la factura del periodo
     * suma los deltas de ambas ventanas (A antes del retiro + A cierre + B).
     */
    public function test_retiro_a_mitad_de_periodo_con_cierre_suma_deltas_de_ambas_impresoras(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);
        $inicioMes = today()->startOfMonth()->toDateString();
        $finMes = today()->endOfMonth()->toDateString();

        $contract = $this->createContract($client, $user, ['fecha_inicio' => $inicioMes]);
        $printerA = $this->createPrinter($user);
        $printerB = $this->createPrinter($user);

        // Ventana A: asignada desde el inicio del mes.
        $contract->printers()->attach($printerA->id, [
            'fecha_asignacion' => $inicioMes,
            'activa' => true,
            'lectura_inicial' => 0,
        ]);
        $this->createReading($contract, $printerA, $user, today()->toDateString(), 700);

        // Retiro con lectura de cierre (700 -> 1000 = 300 páginas).
        $warehouse = \App\Models\Warehouse::create(['nombre' => 'Almacén', 'direccion' => 'Calle 1']);
        app(\App\Services\ContractService::class)->releasePrinter(
            $contract,
            $printerA,
            $warehouse->id,
            $user,
            null,
            1000,
            'SUSTITUCION_FALLA',
            null
        );

        // Ventana B: sustituta desde hoy.
        $contract->printers()->attach($printerB->id, [
            'fecha_asignacion' => today()->toDateString(),
            'activa' => true,
            'lectura_inicial' => 0,
        ]);
        $this->createReading($contract, $printerB, $user, today()->toDateString(), 800);

        $service = app(InvoiceCalculationService::class);
        $result = $service->calcularEstimacion($client->id, $inicioMes, $finMes);

        // 700 (lectura A) + 300 (cierre A) + 800 (lectura B) = 1800 páginas.
        $this->assertSame(1800, (int) $result['contratos'][0]['total_paginas']);
        $this->assertCount(3, $result['detalles']);
        $this->assertFalse(
            collect($result['advertencias'])->contains(fn ($a) => str_contains($a, 'sin lectura de cierre'))
        );
    }

    public function test_retiro_sin_cierre_genera_advertencia_de_brecha(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);
        $inicioMes = today()->startOfMonth()->toDateString();
        $finMes = today()->endOfMonth()->toDateString();

        $contract = $this->createContract($client, $user, ['fecha_inicio' => $inicioMes]);
        $printerA = $this->createPrinter($user);
        $printerB = $this->createPrinter($user);

        $contract->printers()->attach($printerA->id, [
            'fecha_asignacion' => $inicioMes,
            'activa' => true,
            'lectura_inicial' => 0,
        ]);
        $this->createReading($contract, $printerA, $user, today()->toDateString(), 700);

        // Retiro sin lectura de cierre (impresora muerta).
        $warehouse = \App\Models\Warehouse::create(['nombre' => 'Almacén', 'direccion' => 'Calle 1']);
        app(\App\Services\ContractService::class)->releasePrinter(
            $contract,
            $printerA,
            $warehouse->id,
            $user,
            null,
            null,
            'SUSTITUCION_FALLA',
            'Equipo muerto, sin lectura posible'
        );

        $contract->printers()->attach($printerB->id, [
            'fecha_asignacion' => today()->toDateString(),
            'activa' => true,
            'lectura_inicial' => 0,
        ]);
        $this->createReading($contract, $printerB, $user, today()->toDateString(), 800);

        $service = app(InvoiceCalculationService::class);
        $result = $service->calcularEstimacion($client->id, $inicioMes, $finMes);

        // La última lectura de A (700) sí se factura; solo la brecha entre esa
        // lectura y el retiro se pierde. Total: 700 (A) + 800 (B) = 1500.
        $this->assertSame(1500, (int) $result['contratos'][0]['total_paginas']);
        $this->assertTrue(
            collect($result['advertencias'])->contains(
                fn ($a) => str_contains($a, 'sin lectura de cierre')
                    && str_contains($a, $printerA->num_serie)
            )
        );
    }

    private function setupClientWithReading(int $pages = 700): array
    {
        $user = $this->createUser();
        $client = $this->createClient($user);
        $contract = $this->createContract($client, $user);
        $printer = $this->createPrinter($user);
        $this->attachPrinter($contract, $printer);
        $reading = $this->createReading($contract, $printer, $user, '2026-06-05', $pages);

        return [$user, $client, $contract, $printer, $reading];
    }

    public function test_create_recalcula_monto_y_ignora_el_enviado_por_cliente(): void
    {
        [$user, $client] = $this->setupClientWithReading(700);

        // Payload malicioso: monto_total 0 y detalle con monto 0.
        $service = app(InvoiceService::class);
        $invoice = $service->create([
            'numero_factura' => 'F-' . uniqid(),
            'cliente_id' => $client->id,
            'fecha_emision' => '2026-06-10',
            'fecha_vencimiento' => '2026-07-10',
            'periodo_inicio' => '2026-06-01',
            'periodo_fin' => '2026-06-30',
            'monto_total' => 0,
            'detalles' => [
                ['contrato_id' => null, 'lectura_id' => null, 'monto_calculado' => 0],
            ],
        ], $user);

        // El servidor recalculo: 700 pag -> 1500 + 200*0.01 = 1502, no 0.
        $this->assertEquals(1502.0, (float) $invoice->monto_total);
        $this->assertEquals(1502.0, (float) $invoice->saldo_pendiente);
        $this->assertNotEmpty($invoice->details);
    }

    public function test_create_rechaza_detalles_sin_periodo(): void
    {
        [$user, $client] = $this->setupClientWithReading(700);

        $this->expectException(BusinessRuleException::class);

        app(InvoiceService::class)->create([
            'numero_factura' => 'F-' . uniqid(),
            'cliente_id' => $client->id,
            'fecha_emision' => '2026-06-10',
            'fecha_vencimiento' => '2026-07-10',
            'monto_total' => 1,
            'detalles' => [
                ['lectura_id' => 1, 'monto_calculado' => 1],
            ],
        ], $user);
    }

    public function test_create_no_reutiliza_lectura_ya_facturada(): void
    {
        [$user, $client, , , $reading] = $this->setupClientWithReading(700);

        // Primera factura consume la lectura (servidor recalcula -> 1502).
        $service = app(InvoiceService::class);
        $first = $service->create([
            'numero_factura' => 'F-A-' . uniqid(),
            'cliente_id' => $client->id,
            'fecha_emision' => '2026-06-10',
            'fecha_vencimiento' => '2026-07-10',
            'periodo_inicio' => '2026-06-01',
            'periodo_fin' => '2026-06-30',
            'monto_total' => 0,
            'detalles' => [['lectura_id' => $reading->id, 'monto_calculado' => 0]],
        ], $user);
        $this->assertEquals(1502.0, (float) $first->monto_total);

        // Segunda factura del mismo periodo: el re-calculo del servidor excluye
        // la lectura ya facturada y cobra solo la renta base (1500).
        $second = $service->create([
            'numero_factura' => 'F-B-' . uniqid(),
            'cliente_id' => $client->id,
            'fecha_emision' => '2026-06-11',
            'fecha_vencimiento' => '2026-07-11',
            'periodo_inicio' => '2026-06-01',
            'periodo_fin' => '2026-06-30',
            'monto_total' => 0,
            'detalles' => [['lectura_id' => $reading->id, 'monto_calculado' => 0]],
        ], $user);

        $this->assertEquals(1500.0, (float) $second->monto_total);
        $this->assertNull(
            $second->details->firstWhere('lectura_id', $reading->id),
            'La segunda factura no debe reutilizar la lectura ya facturada'
        );
    }
}
