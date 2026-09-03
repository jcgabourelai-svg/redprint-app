<?php

namespace Tests\Feature;

use App\Enums\ContractStatus;
use App\Enums\PrinterStatus;
use App\Enums\VisitFrequency;
use App\Exceptions\BusinessRuleException;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Invoice;
use App\Models\InvoiceDetail;
use App\Models\Printer;
use App\Models\PrinterBrand;
use App\Models\PrinterModel;
use App\Models\Reading;
use App\Models\Role;
use App\Models\User;
use App\Models\Visit;
use App\Services\ContractBillingService;
use App\Services\InvoiceCalculationService;
use App\Services\InvoiceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Facturación por contrato con periodos fijos (D17-D20): ingresos atribuidos
 * por detalles, cálculo por contrato, estado de facturación y batch de
 * borradores con bloqueo duro de duplicados.
 */
class InvoiceContractBillingTest extends TestCase
{
    use RefreshDatabase;

    private function createUser(): User
    {
        return User::create([
            'nombre' => 'Socio Test',
            'correo' => 'socio-' . uniqid() . '@test.com',
            'contrasena_hash' => 'password',
            'telefono' => '555-0100',
            'activo' => true,
            'fecha_creacion' => now(),
        ]);
    }

    private function createClient(User $user, array $overrides = []): Client
    {
        return Client::create(array_merge([
            'razon_social' => 'Cliente Test SA',
            'rfc' => 'CTS010101ABC',
            'nombre_contacto' => 'Contacto',
            'telefono' => '555-0200',
            'correo' => 'cliente@test.com',
            'direccion_instalacion' => 'Calle Falsa 123',
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ], $overrides));
    }

    private function createContract(Client $client, User $user, array $overrides = []): Contract
    {
        return Contract::create(array_merge([
            'cliente_id' => $client->id,
            'codigo_negocio' => 'CTR-' . uniqid(),
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
            'fecha_asignacion' => today(),
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

    private function createInvoice(User $user, Client $client, array $overrides = []): Invoice
    {
        return Invoice::create(array_merge([
            'numero_factura' => 'F-' . uniqid(),
            'cliente_id' => $client->id,
            'contrato_id' => null,
            'fecha_emision' => today(),
            'fecha_vencimiento' => today()->addDays(30),
            'periodo_inicio' => null,
            'periodo_fin' => null,
            'monto_total' => 1000,
            'monto_pagado' => 0,
            'saldo_pendiente' => 1000,
            'estado' => 'PENDIENTE',
            'socio_id' => $user->id,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ], $overrides));
    }

    private function createDetail(Invoice $invoice, ?Contract $contract, array $overrides = []): InvoiceDetail
    {
        return InvoiceDetail::create(array_merge([
            'factura_id' => $invoice->id,
            'contrato_id' => $contract?->id,
            'impresora_id' => null,
            'lectura_id' => null,
            'paginas_consumidas' => 0,
            'monto_calculado' => 0,
        ], $overrides));
    }

    private function actingAsAdmin(User $user): void
    {
        $role = Role::create([
            'nombre' => 'Administrador Test',
            'slug' => 'administrador-test-' . uniqid(),
            'descripcion' => 'Rol sistema para pruebas',
            'es_sistema' => true,
        ]);
        $user->update(['rol_id' => $role->id]);
        Sanctum::actingAs($user->fresh());
    }

    // =====================================================
    // Fase 0 — Ingresos por contrato (D19)
    // =====================================================

    public function test_ingresos_mono_contrato_atribuye_monto_pagado_completo(): void
    {
        [$user, $client, $contract] = $this->setupClientWithContract();

        $factura = $this->createInvoice($user, $client, [
            'contrato_id' => $contract->id,
            'monto_total' => 1000,
            'monto_pagado' => 400,
            'saldo_pendiente' => 600,
            'periodo_inicio' => '2026-06-01',
            'periodo_fin' => '2026-06-30',
        ]);
        $this->createDetail($factura, $contract, ['monto_calculado' => 1000]);

        $this->assertEquals(400.0, $contract->fresh()->ingresos);
    }

    public function test_ingresos_multi_contrato_atribucion_proporcional_con_pago_parcial(): void
    {
        [$user, $client, $contratoA, $contratoB] = $this->setupClientWithTwoContracts();

        // Factura agrupada por cliente: A=600, B=400 de un total de 1000.
        // Pago parcial de 500 -> A atribuye 500*(600/1000)=300, B 200.
        $factura = $this->createInvoice($user, $client, [
            'contrato_id' => null,
            'monto_total' => 1000,
            'monto_pagado' => 500,
            'saldo_pendiente' => 500,
            'periodo_inicio' => '2026-06-01',
            'periodo_fin' => '2026-06-30',
        ]);
        $this->createDetail($factura, $contratoA, ['monto_calculado' => 600]);
        $this->createDetail($factura, $contratoB, ['monto_calculado' => 400]);

        $this->assertEquals(300.0, $contratoA->fresh()->ingresos);
        $this->assertEquals(200.0, $contratoB->fresh()->ingresos);
    }

    public function test_ingresos_excluyen_borradores(): void
    {
        [$user, $client, $contract] = $this->setupClientWithContract();

        $borrador = $this->createInvoice($user, $client, [
            'contrato_id' => $contract->id,
            'numero_factura' => null,
            'monto_total' => 1000,
            'monto_pagado' => 0,
            'saldo_pendiente' => 0,
            'estado' => 'BORRADOR',
            'periodo_inicio' => '2026-06-01',
            'periodo_fin' => '2026-06-30',
        ]);
        $this->createDetail($borrador, $contract, ['monto_calculado' => 1000]);

        $this->assertEquals(0.0, $contract->fresh()->ingresos);
    }

    public function test_ingresos_factura_multi_con_monto_total_cero_aporta_cero(): void
    {
        [$user, $client, $contratoA, $contratoB] = $this->setupClientWithTwoContracts();

        // Datos legacy: total 0 pero con detalles. El guard evita división 0.
        $factura = $this->createInvoice($user, $client, [
            'monto_total' => 0,
            'monto_pagado' => 100,
            'saldo_pendiente' => 0,
            'periodo_inicio' => '2026-06-01',
            'periodo_fin' => '2026-06-30',
        ]);
        $this->createDetail($factura, $contratoA, ['monto_calculado' => 600]);
        $this->createDetail($factura, $contratoB, ['monto_calculado' => 400]);

        $this->assertEquals(0.0, $contratoA->fresh()->ingresos);
        $this->assertEquals(0.0, $contratoB->fresh()->ingresos);
    }

    // =====================================================
    // Fase 1 — Motor de cálculo por contrato + contrato_id
    // =====================================================

    public function test_calcular_filtrado_por_contrato_no_toca_lecturas_del_otro(): void
    {
        [$user, $client, $contratoA, $contratoB, $printerA, $printerB, $readingA, $readingB] =
            $this->setupClientWithTwoContractsAndReadings('2026-06-05');

        $service = app(InvoiceCalculationService::class);

        // Solo contrato A: 1000 + 100*0.01 = 1001, sin lecturas de B.
        $filtrado = $service->calcularEstimacion($client->id, '2026-06-01', '2026-06-30', null, (int) $contratoA->id);
        $this->assertEquals(1001.0, $filtrado['monto_total']);
        $this->assertNotNull(collect($filtrado['detalles'])->firstWhere('lectura_id', $readingA->id));
        $this->assertNull(collect($filtrado['detalles'])->firstWhere('lectura_id', $readingB->id));

        // Sin filtro (wizard): agrupa ambos contratos (B = 500 + 200*0.015 = 503).
        $cliente = $service->calcularEstimacion($client->id, '2026-06-01', '2026-06-30');
        $this->assertEquals(1001.0 + 503.0, $cliente['monto_total']);
    }

    public function test_calcular_con_contrato_de_otro_cliente_lanza_422(): void
    {
        [$user, $client, $contratoPropio] = $this->setupClientWithContract();
        [$user2, $client2, $contratoAjeno] = $this->setupClientWithContract();

        try {
            app(InvoiceCalculationService::class)
                ->calcularEstimacion($client->id, '2026-06-01', '2026-06-30', null, (int) $contratoAjeno->id);
            $this->fail('Calcular con contrato de otro cliente debio lanzar BusinessRuleException.');
        } catch (BusinessRuleException $e) {
            $this->assertStringContainsString('no pertenece al cliente', $e->getMessage());
        }
    }

    public function test_calcular_con_contrato_inactivo_lanza_422(): void
    {
        [$user, $client, $contrato] = $this->setupClientWithContract(['estado' => ContractStatus::SUSPENDIDO]);

        $this->expectException(BusinessRuleException::class);
        $this->expectExceptionMessage('no está activo');

        app(InvoiceCalculationService::class)
            ->calcularEstimacion($client->id, '2026-06-01', '2026-06-30', null, (int) $contrato->id);
    }

    public function test_create_draft_setea_contrato_id_explicito(): void
    {
        [$user, $client, $contratoA, $contratoB, $printerA, $printerB, $readingA, $readingB] =
            $this->setupClientWithTwoContractsAndReadings('2026-06-05');

        $result = app(InvoiceService::class)->createDraft([
            'cliente_id' => $client->id,
            'contrato_id' => $contratoA->id,
            'periodo_inicio' => '2026-06-01',
            'periodo_fin' => '2026-06-30',
        ], $user);

        $this->assertEquals($contratoA->id, $result['invoice']->contrato_id);
        $this->assertEquals(1001.0, (float) $result['invoice']->monto_total);
        $this->assertNull($result['invoice']->details->firstWhere('lectura_id', $readingB->id));
    }

    public function test_create_draft_auto_deriva_contrato_id_en_cliente_mono_contrato(): void
    {
        [$user, $client, $contrato, $printer] = $this->setupClientWithContractAndPrinter();
        $this->createReading($contrato, $printer, $user, '2026-06-05', 700);

        $result = app(InvoiceService::class)->createDraft([
            'cliente_id' => $client->id,
            'periodo_inicio' => '2026-06-01',
            'periodo_fin' => '2026-06-30',
        ], $user);

        $this->assertEquals($contrato->id, $result['invoice']->contrato_id);
    }

    public function test_create_draft_multi_contrato_mantiene_contrato_id_null(): void
    {
        [$user, $client, $contratoA, $contratoB, $printerA, $printerB] =
            $this->setupClientWithTwoContractsAndReadings('2026-06-05');

        $result = app(InvoiceService::class)->createDraft([
            'cliente_id' => $client->id,
            'periodo_inicio' => '2026-06-01',
            'periodo_fin' => '2026-06-30',
        ], $user);

        // El wizard agrupa ambos contratos en un folio: encabezado null.
        $this->assertNull($result['invoice']->contrato_id);
        $this->assertEquals(1001.0 + 503.0, (float) $result['invoice']->monto_total);
    }

    public function test_recalcular_conserva_alcance_mono_contrato(): void
    {
        [$user, $client, $contratoA, $contratoB, $printerA, $printerB] =
            $this->setupClientWithTwoContractsAndReadings('2026-06-05');

        $service = app(InvoiceService::class);
        $draft = $service->createDraft([
            'cliente_id' => $client->id,
            'contrato_id' => $contratoA->id,
            'periodo_inicio' => '2026-06-01',
            'periodo_fin' => '2026-06-30',
        ], $user)['invoice'];

        // Llega una lectura nueva del contrato B dentro del periodo: el
        // borrador mono-contrato de A no debe mutar a multi-contrato.
        $this->createReading($contratoB, $printerB, $user, '2026-06-20', 900);

        $result = $service->recalcular($draft);
        $recalculada = $result['invoice'];

        $this->assertEquals($contratoA->id, $recalculada->contrato_id);
        $this->assertEquals(1001.0, (float) $recalculada->monto_total);
        $this->assertEquals(1, $recalculada->details->count());
    }

    // =====================================================
    // Fase 2 — Estado de facturación del contrato
    // =====================================================

    public function test_estado_facturacion_cubre_mes_por_detalles_multi_contrato(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-01'));

        try {
            [$user, $client, $contratoA, $contratoB] = $this->setupClientWithTwoContracts(
                ['fecha_inicio' => '2026-06-01']
            );

            // Factura multi-contrato de junio (agrupada por cliente).
            $factura = $this->createInvoice($user, $client, [
                'periodo_inicio' => '2026-06-01',
                'periodo_fin' => '2026-06-30',
                'monto_total' => 900,
                'monto_pagado' => 900,
                'saldo_pendiente' => 0,
                'estado' => 'PAGADA',
            ]);
            $this->createDetail($factura, $contratoA, ['monto_calculado' => 600]);
            $this->createDetail($factura, $contratoB, ['monto_calculado' => 300]);

            $estado = app(ContractBillingService::class)->estadoFacturacion($contratoA);

            $this->assertEquals('2026-06-01', $estado['ultimo_periodo_cubierto']);
            $this->assertCount(1, $estado['facturados']);
            $this->assertEquals(600.0, $estado['facturados'][0]['monto_contrato']);
            $this->assertEquals('PAGADA', $estado['facturados'][0]['estado']);

            // Pendientes desde el ciclo de julio (sin el ciclo de junio).
            $periodos = array_column($estado['pendientes'], 'periodo');
            $this->assertEquals(['2026-07-01', '2026-08-01', '2026-09-01'], $periodos);
            $this->assertTrue($estado['pendientes'][2]['actual']);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_estado_facturacion_cubre_mes_por_encabezado_mono(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-01'));

        try {
            [$user, $client, $contrato] = $this->setupClientWithContract(['fecha_inicio' => '2026-06-01']);

            $factura = $this->createInvoice($user, $client, [
                'contrato_id' => $contrato->id,
                'periodo_inicio' => '2026-06-01',
                'periodo_fin' => '2026-06-30',
            ]);
            $this->createDetail($factura, $contrato, ['monto_calculado' => 1000]);

            $estado = app(ContractBillingService::class)->estadoFacturacion($contrato);

            $this->assertEquals('2026-06-01', $estado['ultimo_periodo_cubierto']);
            $this->assertEquals($factura->id, $estado['facturados'][0]['factura_id']);
            $this->assertNotContains('2026-06-01', array_column($estado['pendientes'], 'periodo'));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_estado_facturacion_cobertura_por_interseccion_de_rango_libre(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-01'));

        try {
            [$user, $client, $contrato] = $this->setupClientWithContract(['fecha_inicio' => '2026-06-01']);

            // Captura directa con rango libre que cruza junio y julio.
            $factura = $this->createInvoice($user, $client, [
                'contrato_id' => $contrato->id,
                'periodo_inicio' => '2026-06-10',
                'periodo_fin' => '2026-07-20',
            ]);
            $this->createDetail($factura, $contrato, ['monto_calculado' => 1000]);

            $estado = app(ContractBillingService::class)->estadoFacturacion($contrato);

            // Conservador por intersección: los ciclos de junio Y julio quedan cubiertos.
            $this->assertEquals('2026-07-01', $estado['ultimo_periodo_cubierto']);
            $pendientes = array_column($estado['pendientes'], 'periodo');
            $this->assertEquals(['2026-08-01', '2026-09-01'], $pendientes);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_estado_facturacion_primer_periodo_parcial(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-01'));

        try {
            // Contrato inicia el 15 de junio: ciclos 15..14 del mes siguiente.
            [$user, $client, $contrato] = $this->setupClientWithContract([
                'fecha_inicio' => '2026-06-15',
            ]);

            $estado = app(ContractBillingService::class)->estadoFacturacion($contrato);

            $periodos = array_column($estado['pendientes'], 'periodo');
            $this->assertEquals(['2026-06-15', '2026-07-15', '2026-08-15'], $periodos);
            $this->assertEquals('2026-06-15', $estado['pendientes'][0]['periodo_inicio']);
            $this->assertEquals('2026-07-14', $estado['pendientes'][0]['periodo_fin']);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_estado_facturacion_ultimo_periodo_truncado_si_finalizo_a_medias(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-01'));

        try {
            // Contrato finalizado el 10 de agosto: pendientes hasta agosto,
            // con el ultimo periodo truncado a fecha_fin.
            [$user, $client, $contrato] = $this->setupClientWithContract([
                'fecha_inicio' => '2026-06-01',
                'fecha_fin' => '2026-08-10',
                'estado' => ContractStatus::FINALIZADO,
            ]);

            $estado = app(ContractBillingService::class)->estadoFacturacion($contrato);

            $pendientes = array_column($estado['pendientes'], 'periodo');
            $this->assertEquals(['2026-06-01', '2026-07-01', '2026-08-01'], $pendientes);
            $ultimo = $estado['pendientes'][2];
            $this->assertEquals('2026-08-01', $ultimo['periodo_inicio']);
            $this->assertEquals('2026-08-10', $ultimo['periodo_fin']);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_estado_facturacion_suspendido_sin_pendientes_pero_lista_facturados(): void
    {
        [$user, $client, $contrato] = $this->setupClientWithContract([
            'estado' => ContractStatus::SUSPENDIDO,
            'fecha_inicio' => '2026-06-01',
        ]);

        $factura = $this->createInvoice($user, $client, [
            'contrato_id' => $contrato->id,
            'periodo_inicio' => '2026-06-01',
            'periodo_fin' => '2026-06-30',
        ]);
        $this->createDetail($factura, $contrato, ['monto_calculado' => 1000]);

        $estado = app(ContractBillingService::class)->estadoFacturacion($contrato);

        $this->assertEmpty($estado['pendientes']);
        $this->assertCount(1, $estado['facturados']);
        $this->assertEquals('2026-06-01', $estado['ultimo_periodo_cubierto']);
    }

    public function test_estado_facturacion_incluye_borradores_en_cubiertos(): void
    {
        [$user, $client, $contrato, $printer] = $this->setupClientWithContractAndPrinter(['fecha_inicio' => today()->subMonth()->startOfMonth()]);
        $this->createReading($contrato, $printer, $user, today()->subMonth()->startOfMonth()->toDateString(), 700);

        $service = app(InvoiceService::class);
        $borrador = $service->createDraft([
            'cliente_id' => $client->id,
            'contrato_id' => $contrato->id,
            'periodo_inicio' => today()->subMonth()->startOfMonth()->toDateString(),
            'periodo_fin' => today()->subMonth()->endOfMonth()->toDateString(),
        ], $user)['invoice'];

        $estado = app(ContractBillingService::class)->estadoFacturacion($contrato);

        // El borrador reserva el ciclo: no vuelve a aparecer como pendiente.
        $this->assertNotContains(
            today()->subMonth()->startOfMonth()->toDateString(),
            array_column($estado['pendientes'], 'periodo'),
        );
        $this->assertEquals(
            today()->subMonth()->startOfMonth()->toDateString(),
            $estado['ultimo_periodo_cubierto'],
        );
        $this->assertEquals($borrador->id, $estado['facturados'][0]['factura_id']);
        $this->assertNull($estado['facturados'][0]['numero_factura']);
    }

    public function test_endpoint_facturacion_contrato(): void
    {
        [$user, $client, $contrato] = $this->setupClientWithContract(['fecha_inicio' => '2026-06-01']);
        $this->actingAsAdmin($user);

        $response = $this->getJson("/api/v1/contracts/{$contrato->id}/facturacion");

        $response->assertOk()
            ->assertJsonStructure(['facturados', 'pendientes', 'ultimo_periodo_cubierto']);
        $this->assertNotEmpty($response->json('pendientes'));
    }

    // =====================================================
    // Fase 3 — Batch de borradores + bloqueo duro (D20)
    // =====================================================

    public function test_batch_3_periodos_saltados_crea_3_borradores_con_sus_lecturas(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-05'));

        try {
            [$user, $client, $contrato, $printer] = $this->setupClientWithContractAndPrinter([
                'fecha_inicio' => '2026-05-01',
            ]);

            // Una lectura de corte por ciclo saltado (jun, jul, ago; dentro
            // de la ventana de cierre con gracia 15) + una del ciclo en
            // curso que NO se selecciona (queda pendiente, caso 4).
            $readingJun = $this->createReading($contrato, $printer, $user, '2026-06-28', 700);
            $this->createReading($contrato, $printer, $user, '2026-07-28', 800);
            $this->createReading($contrato, $printer, $user, '2026-08-28', 900);
            $readingSep = $this->createReading($contrato, $printer, $user, '2026-09-20', 1000);

            $resultados = app(InvoiceService::class)->createDraftBatch([
                'cliente_id' => $client->id,
                'contrato_id' => $contrato->id,
                'periodos' => ['2026-06-01', '2026-07-01', '2026-08-01'],
            ], $user);

            $this->assertCount(3, $resultados);
            $this->assertEquals(['2026-06-01', '2026-07-01', '2026-08-01'], array_keys($resultados));

            foreach ($resultados as $periodo => $r) {
                $invoice = $r['invoice'];
                $this->assertSame(\App\Enums\InvoiceStatus::BORRADOR, $invoice->estado);
                $this->assertEquals($contrato->id, $invoice->contrato_id);
                // Invariante única: cada borrador reserva SOLO su lectura.
                $this->assertEquals(1, $invoice->details->count());
                $this->assertEqualsWithDelta(
                    (float) $invoice->monto_total,
                    (float) $invoice->details->sum('monto_calculado'),
                    0.001,
                );
            }

            // Mayo (ciclo 0) nunca se facturó: M = −1 y el hueco de junio se
            // mide desde el inicio del contrato con 2× paquete (700 ≤ 1000 →
            // 1500). Julio y agosto ya tienen base facturada → 1× cada uno.
            $this->assertEquals(1500.0, (float) $resultados['2026-06-01']['invoice']->monto_total);
            $this->assertEquals(1503.0, (float) $resultados['2026-07-01']['invoice']->monto_total);
            $this->assertEquals(1504.0, (float) $resultados['2026-08-01']['invoice']->monto_total);
            $this->assertNotNull($resultados['2026-06-01']['invoice']->details->firstWhere('lectura_id', $readingJun->id));

            // La lectura de septiembre queda pendiente (no se pierde).
            $this->assertEquals(0, InvoiceDetail::where('lectura_id', $readingSep->id)->count());

            $estado = app(ContractBillingService::class)->estadoFacturacion($contrato);
            $this->assertContains('2026-09-01', array_column($estado['pendientes'], 'periodo'));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_batch_renta_fija_sin_lecturas_genera_linea_de_tarifa_por_borrador(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-05'));

        try {
            [$user, $client, $contrato, $printer] = $this->setupClientWithContractAndPrinter([
                'fecha_inicio' => '2026-05-01',
            ]);

            $resultados = app(InvoiceService::class)->createDraftBatch([
                'cliente_id' => $client->id,
                'contrato_id' => $contrato->id,
                'periodos' => ['2026-06-01', '2026-07-01', '2026-08-01'],
            ], $user);

            $this->assertCount(3, $resultados);
            foreach ($resultados as $r) {
                // D18: cada ciclo conserva su tarifa base (una línea por ciclo).
                $this->assertEquals(1500.0, (float) $r['invoice']->monto_total);
                $this->assertEquals(1, $r['invoice']->details->count());
                $this->assertNull($r['invoice']->details->first()->lectura_id);
            }
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_batch_duplicado_por_factura_multi_contrato_422_y_rollback_total(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-05'));

        try {
            [$user, $client, $contratoA, $contratoB] = $this->setupClientWithTwoContracts([
                'fecha_inicio' => '2026-05-01',
            ]);

            // Factura multi-contrato de julio ya emitida (toca A por detalles).
            $existente = $this->createInvoice($user, $client, [
                'periodo_inicio' => '2026-07-01',
                'periodo_fin' => '2026-07-31',
            ]);
            $this->createDetail($existente, $contratoA, ['monto_calculado' => 600]);
            $this->createDetail($existente, $contratoB, ['monto_calculado' => 300]);

            try {
                app(InvoiceService::class)->createDraftBatch([
                    'cliente_id' => $client->id,
                    'contrato_id' => $contratoA->id,
                    'periodos' => ['2026-06-01', '2026-07-01'],
                ], $user);
                $this->fail('El batch con julio duplicado debio lanzar BusinessRuleException.');
            } catch (BusinessRuleException $e) {
                // Mensaje que identifica el periodo fallido.
                $this->assertStringContainsString('El periodo 2026-07-01', $e->getMessage());
                $this->assertStringContainsString($existente->numero_factura, $e->getMessage());
            }

            // All-or-nothing: junio tampoco se creo (rollback total).
            $this->assertEquals(1, Invoice::where('cliente_id', $client->id)->count());
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_batch_fallo_de_monto_rollback_total_con_mensaje_del_periodo(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-05'));

        try {
            // Contrato puro consumo (tarifa 0): junio tiene lectura de corte,
            // julio no genera monto (renta base 0).
            [$user, $client, $contrato, $printer] = $this->setupClientWithContractAndPrinter([
                'fecha_inicio' => '2026-05-01',
                'tarifa_base' => 0,
                'paginas_incluidas' => 0,
                'costo_pag_excedente' => 0.01,
            ]);
            $this->createReading($contrato, $printer, $user, '2026-06-28', 500);

            try {
                app(InvoiceService::class)->createDraftBatch([
                    'cliente_id' => $client->id,
                    'contrato_id' => $contrato->id,
                    'periodos' => ['2026-06-01', '2026-07-01'],
                ], $user);
                $this->fail('El batch con julio sin monto debio lanzar BusinessRuleException.');
            } catch (BusinessRuleException $e) {
                $this->assertStringContainsString('El periodo 2026-07-01', $e->getMessage());
                $this->assertStringContainsString('no genera monto', $e->getMessage());
            }

            // Regla 4: nada se creo.
            $this->assertEquals(0, Invoice::where('cliente_id', $client->id)->count());
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_emitir_bloqueado_por_factura_emitida_posterior(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-05'));

        try {
            [$user, $client, $contrato, $printer] = $this->setupClientWithContractAndPrinter([
                'fecha_inicio' => '2026-05-01',
            ]);
            $this->createReading($contrato, $printer, $user, '2026-06-05', 700);

            $service = app(InvoiceService::class);
            $draft = $service->createDraft([
                'cliente_id' => $client->id,
                'contrato_id' => $contrato->id,
                'periodo_inicio' => '2026-06-01',
                'periodo_fin' => '2026-06-30',
            ], $user)['invoice'];

            // Mientras el borrador esperaba, se emitio otra factura de junio
            // que toca el mismo contrato.
            $posterior = $this->createInvoice($user, $client, [
                'contrato_id' => $contrato->id,
                'periodo_inicio' => '2026-06-01',
                'periodo_fin' => '2026-06-30',
            ]);
            $this->createDetail($posterior, $contrato, ['monto_calculado' => 1502]);

            try {
                $service->emitir($draft, ['numero_factura' => 'F-EMIT-LATE', 'fecha_emision' => '2026-07-10']);
                $this->fail('Emitir un borrador duplicado debio lanzar BusinessRuleException.');
            } catch (BusinessRuleException $e) {
                $this->assertStringContainsString('No se puede facturar dos veces', $e->getMessage());
                $this->assertStringContainsString($posterior->numero_factura, $e->getMessage());
            }
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_captura_directa_con_solape_permitida(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-05'));

        try {
            [$user, $client, $contrato, $printer] = $this->setupClientWithContractAndPrinter([
                'fecha_inicio' => '2026-05-01',
            ]);

            $existente = $this->createInvoice($user, $client, [
                'contrato_id' => $contrato->id,
                'periodo_inicio' => '2026-06-01',
                'periodo_fin' => '2026-06-30',
            ]);
            $this->createDetail($existente, $contrato, ['monto_calculado' => 1500]);

            // D20: la captura directa registra un hecho fiscal ya existente:
            // solo advertencia, nunca bloqueo.
            $directa = app(InvoiceService::class)->create([
                'numero_factura' => 'F-PAC-DUP',
                'cliente_id' => $client->id,
                'fecha_emision' => '2026-07-01',
                'periodo_inicio' => '2026-06-01',
                'periodo_fin' => '2026-06-30',
                'monto_total' => 500,
            ], $user);

            $this->assertSame(\App\Enums\InvoiceStatus::PENDIENTE, $directa->estado);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_borrador_contrato_a_no_bloquea_borrador_contrato_b(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-05'));

        try {
            [$user, $client, $contratoA, $contratoB] = $this->setupClientWithTwoContracts([
                'fecha_inicio' => '2026-05-01',
            ]);

            $service = app(InvoiceService::class);
            $draftA = $service->createDraft([
                'cliente_id' => $client->id,
                'contrato_id' => $contratoA->id,
                'periodo_inicio' => '2026-06-01',
                'periodo_fin' => '2026-06-30',
            ], $user)['invoice'];

            // Alcances distintos (A vs B): el mes no esta duplicado para B.
            $draftB = $service->createDraft([
                'cliente_id' => $client->id,
                'contrato_id' => $contratoB->id,
                'periodo_inicio' => '2026-06-01',
                'periodo_fin' => '2026-06-30',
            ], $user)['invoice'];

            $this->assertNotEquals($draftA->id, $draftB->id);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_endpoint_draft_batch_crea_borradores(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-05'));

        try {
            [$user, $client, $contrato] = $this->setupClientWithContract(['fecha_inicio' => '2026-05-01']);
            $this->actingAsAdmin($user);

            $response = $this->postJson('/api/v1/invoices/draft-batch', [
                'cliente_id' => $client->id,
                'contrato_id' => $contrato->id,
                'periodos' => ['2026-06-01', '2026-07-01'],
            ]);

            $response->assertCreated();
            $this->assertCount(2, $response->json('data'));
            $this->assertEquals(1500.0, (float) $response->json('data.0.monto_total'));
            $this->assertArrayHasKey('advertencias', $response->json());
            $this->assertArrayHasKey('2026-06-01', $response->json('advertencias'));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_endpoint_draft_batch_rechaza_periodo_futuro(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-05'));

        try {
            [$user, $client, $contrato] = $this->setupClientWithContract();
            $this->actingAsAdmin($user);

            $this->postJson('/api/v1/invoices/draft-batch', [
                'cliente_id' => $client->id,
                'contrato_id' => $contrato->id,
                'periodos' => ['2026-12-01'],
            ])->assertStatus(422);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_escenario_ciclo_veinte_con_lectura_temprana_rueda_al_siguiente_ciclo(): void
    {
        // Caso real del usuario (semantica D22): contrato iniciado 20-ago,
        // hoy 2-sep con lectura del 2-sep. La lectura es temprana (fuera de
        // la ventana de cierre [14-sep, 4-oct] con gracia 15): el ciclo 0 se
        // cobra a renta base y la lectura rueda al siguiente ciclo con corte.
        Carbon::setTestNow(Carbon::parse('2026-09-02'));

        try {
            [$user, $client, $contrato, $printer] = $this->setupClientWithContractAndPrinter([
                'fecha_inicio' => '2026-08-20',
            ]);
            $reading = $this->createReading($contrato, $printer, $user, '2026-09-02', 700);

            $estado = app(ContractBillingService::class)->estadoFacturacion($contrato);

            $this->assertCount(1, $estado['pendientes']);
            $pendiente = $estado['pendientes'][0];
            $this->assertEquals('2026-08-20', $pendiente['periodo']);
            $this->assertEquals('2026-08-20', $pendiente['periodo_inicio']);
            $this->assertEquals('2026-09-19', $pendiente['periodo_fin']);
            $this->assertTrue($pendiente['actual']);
            $this->assertEquals(0, $pendiente['lecturas']);
            $this->assertNull($pendiente['lectura_cierre_fecha']);
            $this->assertEquals(1500.0, $pendiente['monto_estimado']);
            $this->assertStringContainsString(
                'Ciclo sin lectura de corte',
                implode(' | ', $pendiente['advertencias']),
            );

            $resultados = app(InvoiceService::class)->createDraftBatch([
                'cliente_id' => $client->id,
                'contrato_id' => $contrato->id,
                'periodos' => ['2026-08-20'],
            ], $user);
            $borrador = $resultados['2026-08-20']['invoice'];
            $this->assertEquals('2026-08-20', $borrador->periodo_inicio->toDateString());
            $this->assertEquals('2026-09-19', $borrador->periodo_fin->toDateString());
            $this->assertEquals(1500.0, (float) $borrador->monto_total);
            $this->assertEquals(1, $borrador->details->count());
            $this->assertNull($borrador->details->first()->lectura_id);

            // La lectura temprana queda pendiente (rueda al ciclo siguiente).
            $this->assertEquals(0, InvoiceDetail::where('lectura_id', $reading->id)->count());

            $estado = app(ContractBillingService::class)->estadoFacturacion($contrato);
            $this->assertEmpty($estado['pendientes']);
            $this->assertEquals('2026-08-20', $estado['ultimo_periodo_cubierto']);

            // D20 sin cambios: repetir el mismo ciclo se bloquea duro.
            $this->expectException(BusinessRuleException::class);
            $this->expectExceptionMessage('No se puede facturar dos veces');
            app(InvoiceService::class)->createDraftBatch([
                'cliente_id' => $client->id,
                'contrato_id' => $contrato->id,
                'periodos' => ['2026-08-20'],
            ], $user);
        } finally {
            Carbon::setTestNow();
        }
    }

    // =====================================================
    // Fase 4 — Arrastre de consumo en ciclos sin corte (D22)
    // =====================================================

    public function test_s1_salto_de_ciclo_con_corte_acumula_paquete(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-25'));

        try {
            [$user, $client, $contrato, $printer] = $this->setupArrastreContrato();
            $lectura = $this->createReading($contrato, $printer, $user, '2026-10-20', 7000);

            $service = app(InvoiceService::class);

            // Ciclo 0 sin lectura de corte: renta base sola.
            $r0 = $service->createDraftBatch([
                'cliente_id' => $client->id,
                'contrato_id' => $contrato->id,
                'periodos' => ['2026-08-20'],
            ], $user)['2026-08-20'];

            $this->assertEquals(1000.0, (float) $r0['invoice']->monto_total);
            $this->assertEquals(1, $r0['invoice']->details->count());
            $this->assertNull($r0['invoice']->details->first()->lectura_id);
            $this->assertStringContainsString('Ciclo sin lectura de corte', implode(' | ', $r0['advertencias']));

            // Ciclo 1 con corte tras el salto: 1000 + max(0, 7000 − 2×3000)×0.10.
            $r1 = $service->createDraftBatch([
                'cliente_id' => $client->id,
                'contrato_id' => $contrato->id,
                'periodos' => ['2026-09-20'],
            ], $user)['2026-09-20'];

            $this->assertEquals(1100.0, (float) $r1['invoice']->monto_total);
            $this->assertNotNull($r1['invoice']->details->firstWhere('lectura_id', $lectura->id));
            $this->assertStringContainsString('Periodo acumulado: 2 ciclo(s) × 3000 páginas incluidas = 6000.',
                implode(' | ', $r1['advertencias']),
            );
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_s2_salto_sin_excedente_cobra_renta_pero_es_ciclo_medido(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-25'));

        try {
            [$user, $client, $contrato, $printer] = $this->setupArrastreContrato();
            $lectura = $this->createReading($contrato, $printer, $user, '2026-10-20', 5000);

            $service = app(InvoiceService::class);
            $service->createDraftBatch([
                'cliente_id' => $client->id,
                'contrato_id' => $contrato->id,
                'periodos' => ['2026-08-20'],
            ], $user);

            // 5000 <= 2×3000: sin excedente, pero el ciclo es medido
            // (reserva la lectura; no es renta base).
            $r1 = $service->createDraftBatch([
                'cliente_id' => $client->id,
                'contrato_id' => $contrato->id,
                'periodos' => ['2026-09-20'],
            ], $user)['2026-09-20'];

            $this->assertEquals(1000.0, (float) $r1['invoice']->monto_total);
            $this->assertEquals(1, $r1['invoice']->details->count());
            $this->assertNotNull($r1['invoice']->details->firstWhere('lectura_id', $lectura->id));
            $this->assertStringNotContainsString('Ciclo sin lectura de corte', implode(' | ', $r1['advertencias']));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_s3_lectura_tardia_dentro_de_gracia_cierra_el_ciclo_anterior(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-25'));

        try {
            [$user, $client, $contrato, $printer] = $this->setupArrastreContrato();
            $tardia = $this->createReading($contrato, $printer, $user, '2026-09-22', 2000);
            $this->createReading($contrato, $printer, $user, '2026-10-17', 2000);

            $service = app(InvoiceService::class);

            // Corte 19-sep + gracia 7: la lectura del 22-sep cierra el ciclo 0
            // (medido, 1× paquete), no el ciclo 1.
            $r0 = $service->createDraftBatch([
                'cliente_id' => $client->id,
                'contrato_id' => $contrato->id,
                'periodos' => ['2026-08-20'],
            ], $user)['2026-08-20'];

            $this->assertNotNull($r0['invoice']->details->firstWhere('lectura_id', $tardia->id));
            $this->assertEquals(1000.0, (float) $r0['invoice']->monto_total);
            $this->assertStringNotContainsString('Periodo acumulado', implode(' | ', $r0['advertencias']));

            // Ciclo 1: base 22-sep -> M = 1 -> 1× (la tardía consumió el
            // paquete del ciclo 0, no el suyo).
            $r1 = $service->createDraftBatch([
                'cliente_id' => $client->id,
                'contrato_id' => $contrato->id,
                'periodos' => ['2026-09-20'],
            ], $user)['2026-09-20'];

            $this->assertEquals(1000.0, (float) $r1['invoice']->monto_total);
            $this->assertStringNotContainsString('Periodo acumulado', implode(' | ', $r1['advertencias']));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_s4_lectura_tardia_fuera_de_gracia_rueda_con_el_hueco_completo(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-25'));

        try {
            [$user, $client, $contrato, $printer] = $this->setupArrastreContrato();
            $tardia = $this->createReading($contrato, $printer, $user, '2026-09-29', 4000);
            $corte = $this->createReading($contrato, $printer, $user, '2026-10-19', 4000);

            $service = app(InvoiceService::class);

            // Fuera de la ventana [14-sep, 26-sep]: ciclo 0 a renta base.
            $r0 = $service->createDraftBatch([
                'cliente_id' => $client->id,
                'contrato_id' => $contrato->id,
                'periodos' => ['2026-08-20'],
            ], $user)['2026-08-20'];

            $this->assertEquals(1000.0, (float) $r0['invoice']->monto_total);
            $this->assertNull($r0['invoice']->details->first()->lectura_id);
            $this->assertEquals(0, InvoiceDetail::where('lectura_id', $tardia->id)->count());

            // Ciclo 1 factura 29-sep + 19-oct con 2× paquete (conservación:
            // Σ paginas_periodo = hueco completo).
            $r1 = $service->createDraftBatch([
                'cliente_id' => $client->id,
                'contrato_id' => $contrato->id,
                'periodos' => ['2026-09-20'],
            ], $user)['2026-09-20'];

            $this->assertEquals(1200.0, (float) $r1['invoice']->monto_total);
            $this->assertEquals(2, $r1['invoice']->details->count());
            $this->assertNotNull($r1['invoice']->details->firstWhere('lectura_id', $tardia->id));
            $this->assertNotNull($r1['invoice']->details->firstWhere('lectura_id', $corte->id));
            $this->assertEquals(8000, (int) $r1['invoice']->details->sum('paginas_consumidas'));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_s5_lectura_temprana_no_cierra_y_rueda_al_siguiente_ciclo(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-25'));

        try {
            [$user, $client, $contrato, $printer] = $this->setupArrastreContrato();
            $temprana = $this->createReading($contrato, $printer, $user, '2026-09-01', 3500);
            $this->createReading($contrato, $printer, $user, '2026-10-17', 3500);

            $service = app(InvoiceService::class);

            // 1-sep fuera de [14-sep, 26-sep]: ciclo 0 a renta base y la
            // lectura temprana NO se factura.
            $r0 = $service->createDraftBatch([
                'cliente_id' => $client->id,
                'contrato_id' => $contrato->id,
                'periodos' => ['2026-08-20'],
            ], $user)['2026-08-20'];

            $this->assertEquals(1000.0, (float) $r0['invoice']->monto_total);
            $this->assertEquals(0, InvoiceDetail::where('lectura_id', $temprana->id)->count());

            // Ciclo 1 la factura junto a la de corte con 2× paquete.
            $r1 = $service->createDraftBatch([
                'cliente_id' => $client->id,
                'contrato_id' => $contrato->id,
                'periodos' => ['2026-09-20'],
            ], $user)['2026-09-20'];

            $this->assertEquals(1100.0, (float) $r1['invoice']->monto_total);
            $this->assertEquals(2, $r1['invoice']->details->count());
            $this->assertNotNull($r1['invoice']->details->firstWhere('lectura_id', $temprana->id));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_s6_cierre_normal_un_paquete_regresion(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-25'));

        try {
            [$user, $client, $contrato, $printer] = $this->setupArrastreContrato();
            $this->createReading($contrato, $printer, $user, '2026-09-17', 3500);

            $calc = app(InvoiceCalculationService::class)
                ->calcularEstimacion($client->id, '2026-08-20', '2026-09-19', null, (int) $contrato->id);

            $this->assertEquals(1, $calc['contratos'][0]['ciclos_acumulados']);
            $this->assertEquals(3000, $calc['contratos'][0]['paginas_incluidas_efectivas']);
            $this->assertEquals('2026-09-17', $calc['contratos'][0]['lectura_cierre_fecha']);
            $this->assertEquals(1050.0, $calc['monto_total']);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_s7_recalcular_upgradea_borrador_renta_base_a_medido(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-25'));

        try {
            [$user, $client, $contrato, $printer] = $this->setupArrastreContrato();

            $service = app(InvoiceService::class);
            $borrador = $service->createDraftBatch([
                'cliente_id' => $client->id,
                'contrato_id' => $contrato->id,
                'periodos' => ['2026-08-20'],
            ], $user)['2026-08-20']['invoice'];

            $this->assertEquals(1000.0, (float) $borrador->monto_total);
            $this->assertNull($borrador->details->first()->lectura_id);

            // Llega la lectura de cierre del ciclo 0.
            $lectura = $this->createReading($contrato, $printer, $user, '2026-09-18', 3500);

            $recalc = $service->recalcular($borrador);

            $this->assertEquals(1050.0, (float) $recalc['invoice']->monto_total);
            $this->assertNotNull($recalc['invoice']->details->firstWhere('lectura_id', $lectura->id));
            $this->assertEqualsWithDelta(
                1050.0,
                (float) $recalc['invoice']->details->sum('monto_calculado'),
                0.001,
            );
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_s8_estimacion_de_pendientes_coincide_con_lo_cobrado(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-19'));

        try {
            [$user, $client, $contrato, $printer] = $this->setupArrastreContrato();
            $this->createReading($contrato, $printer, $user, '2026-10-20', 7000);

            $estado = app(ContractBillingService::class)->estadoFacturacion($contrato);

            $this->assertEquals(['2026-08-20', '2026-09-20'], array_column($estado['pendientes'], 'periodo'));
            $p0 = $estado['pendientes'][0];
            $this->assertEquals(1000.0, $p0['monto_estimado']);
            $this->assertNull($p0['lectura_cierre_fecha']);
            $this->assertEquals(1, $p0['ciclos_acumulados']);
            $p1 = $estado['pendientes'][1];
            $this->assertEquals(1100.0, $p1['monto_estimado']);
            $this->assertEquals(2, $p1['ciclos_acumulados']);
            $this->assertEquals(6000, $p1['paginas_incluidas_efectivas']);
            $this->assertEquals('2026-10-20', $p1['lectura_cierre_fecha']);

            // El batch produce exactamente lo estimado (hilado de simulación).
            $resultados = app(InvoiceService::class)->createDraftBatch([
                'cliente_id' => $client->id,
                'contrato_id' => $contrato->id,
                'periodos' => ['2026-08-20', '2026-09-20'],
            ], $user);
            $this->assertEquals(1000.0, (float) $resultados['2026-08-20']['invoice']->monto_total);
            $this->assertEquals($p1['monto_estimado'], (float) $resultados['2026-09-20']['invoice']->monto_total);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_s9_arrastre_dentro_del_mismo_batch(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-25'));

        try {
            [$user, $client, $contrato, $printer] = $this->setupArrastreContrato();
            $lectura = $this->createReading($contrato, $printer, $user, '2026-10-20', 7000);

            $resultados = app(InvoiceService::class)->createDraftBatch([
                'cliente_id' => $client->id,
                'contrato_id' => $contrato->id,
                'periodos' => ['2026-08-20', '2026-09-20'],
            ], $user);

            $b0 = $resultados['2026-08-20']['invoice'];
            $b1 = $resultados['2026-09-20']['invoice'];
            $this->assertEquals(1000.0, (float) $b0->monto_total);
            $this->assertNull($b0->details->first()->lectura_id);
            $this->assertEquals(1100.0, (float) $b1->monto_total);
            $this->assertNotNull($b1->details->firstWhere('lectura_id', $lectura->id));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_s10_wizard_libre_mantiene_un_paquete_y_su_advertencia(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-25'));

        try {
            [$user, $client, $contrato, $printer] = $this->setupArrastreContrato();
            $this->createReading($contrato, $printer, $user, '2026-10-15', 7000);

            // Sin contrato_id (wizard cliente): rango de 2 meses, 1× paquete.
            $calc = app(InvoiceCalculationService::class)
                ->calcularEstimacion($client->id, '2026-08-20', '2026-10-19');

            $this->assertEquals(1, $calc['contratos'][0]['ciclos_acumulados']);
            // 1000 + (7000 − 3000)×0.10 = 1400.
            $this->assertEquals(1400.0, $calc['monto_total']);
            $this->assertStringContainsString('mes a mes', implode(' | ', $calc['advertencias']));
            $this->assertStringNotContainsString('Periodo acumulado', implode(' | ', $calc['advertencias']));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_s11_multi_impresora_suma_el_hueco_con_allowance_unico(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-25'));

        try {
            [$user, $client, $contrato, $printerA] = $this->setupArrastreContrato();
            $printerB = $this->createPrinter($user);
            $this->attachPrinter($contrato, $printerB);

            $this->createReading($contrato, $printerA, $user, '2026-10-15', 3000);
            $this->createReading($contrato, $printerB, $user, '2026-10-20', 4000);

            $service = app(InvoiceService::class);

            $r0 = $service->createDraftBatch([
                'cliente_id' => $client->id,
                'contrato_id' => $contrato->id,
                'periodos' => ['2026-08-20'],
            ], $user)['2026-08-20'];
            $this->assertEquals(1000.0, (float) $r0['invoice']->monto_total);

            // Σ 7000 de dos impresoras contra allowance único 2×3000.
            $r1 = $service->createDraftBatch([
                'cliente_id' => $client->id,
                'contrato_id' => $contrato->id,
                'periodos' => ['2026-09-20'],
            ], $user)['2026-09-20'];

            $this->assertEquals(1100.0, (float) $r1['invoice']->monto_total);
            $this->assertEquals(2, $r1['invoice']->details->count());
            $this->assertEquals(7000, (int) $r1['invoice']->details->sum('paginas_consumidas'));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_s12_primer_ciclo_desde_lectura_inicial_multiplicador_uno(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-25'));

        try {
            [$user, $client, $contrato, $printer] = $this->setupArrastreContrato();
            $this->createReading($contrato, $printer, $user, '2026-09-18', 3500);

            // Sin lecturas facturadas previas: M = −1, ciclo 0 -> 1×.
            $calc = app(InvoiceCalculationService::class)
                ->calcularEstimacion($client->id, '2026-08-20', '2026-09-19', null, (int) $contrato->id);

            $this->assertEquals(1, $calc['contratos'][0]['ciclos_acumulados']);
            $this->assertEquals(1050.0, $calc['monto_total']);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_s13_finalizado_parcial_conserva_allowance_completo(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-25'));

        try {
            [$user, $client, $contrato, $printer] = $this->setupArrastreContrato([
                'fecha_fin' => '2026-10-05',
                'estado' => ContractStatus::FINALIZADO,
            ]);

            // Ciclo 0 ya facturado a RENTA BASE (sin corte): el arrastre
            // queda abierto para el ciclo final truncado.
            $factura = $this->createInvoice($user, $client, [
                'contrato_id' => $contrato->id,
                'periodo_inicio' => '2026-08-20',
                'periodo_fin' => '2026-09-19',
                'monto_total' => 1000,
                'saldo_pendiente' => 1000,
            ]);
            $this->createDetail($factura, $contrato, ['monto_calculado' => 1000]);

            // Corte dentro del ciclo final truncado (5-oct).
            $this->createReading($contrato, $printer, $user, '2026-10-04', 7000);

            $estado = app(ContractBillingService::class)->estadoFacturacion($contrato);

            $this->assertEquals(['2026-09-20'], array_column($estado['pendientes'], 'periodo'));
            $p = $estado['pendientes'][0];
            $this->assertEquals('2026-09-20', $p['periodo_inicio']);
            $this->assertEquals('2026-10-05', $p['periodo_fin']);
            $this->assertEquals(2, $p['ciclos_acumulados']);
            $this->assertEquals(6000, $p['paginas_incluidas_efectivas']);
            $this->assertEquals('2026-10-04', $p['lectura_cierre_fecha']);
            // 1000 + (7000 − 2×3000)×0.10: allowance completo, sin prorrateo.
            $this->assertEquals(1100.0, $p['monto_estimado']);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_s14_migracion_dias_gracia_default_7_y_regulariza_existentes(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);

        // Default de columna tras la migración D22.
        $nuevo = Contract::create([
            'cliente_id' => $client->id,
            'codigo_negocio' => 'CTR-DEF-' . uniqid(),
            'fecha_inicio' => '2026-08-20',
            'tarifa_base' => 1000,
            'paginas_incluidas' => 3000,
            'costo_pag_excedente' => 0.10,
            'frecuencia_visitas' => VisitFrequency::MENSUAL,
            'estado' => ContractStatus::ACTIVO,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);
        $this->assertEquals(7, (int) $nuevo->fresh()->dias_gracia);

        // Regularización: re-ejecutar up() lleva un 0 preexistente a 7.
        $legacy = $this->createContract($client, $user, ['dias_gracia' => 0]);
        $this->assertEquals(0, (int) $legacy->fresh()->dias_gracia);

        $migracion = require dirname(__DIR__, 2)
            . '/database/migrations/2026_09_02_000000_redefinir_dias_gracia_cierre_de_ciclo.php';
        $migracion->up();

        $this->assertEquals(7, (int) $legacy->fresh()->dias_gracia);
        $this->assertEquals(7, (int) $nuevo->fresh()->dias_gracia);

        // Normalizacion total (complemento): valores heterogeneos pre-D22
        // (seeder antiguo rand 3-15) tambien terminan en 7.
        $heterogeneo = $this->createContract($client, $user, ['dias_gracia' => 15]);
        $this->assertEquals(15, (int) $heterogeneo->fresh()->dias_gracia);

        $normalizacion = require dirname(__DIR__, 2)
            . '/database/migrations/2026_09_02_000100_normaliza_dias_gracia_y_indices_d22.php';
        $normalizacion->up();

        $this->assertEquals(7, (int) $heterogeneo->fresh()->dias_gracia);
        $this->assertEquals(7, (int) $legacy->fresh()->dias_gracia);
        $this->assertEquals(7, (int) $nuevo->fresh()->dias_gracia);
    }

    // =====================================================
    // Setups compartidos
    // =====================================================

    /**
     * Contrato canónico del arrastre (D22): inicio 20-ago-2026, renta 1000,
     * 3000 incluidas, 0.10 excedente, 7 días de gracia. Ciclo 0 =
     * [20-ago, 19-sep] con ventana de cierre [14-sep, 26-sep]; ciclo 1 =
     * [20-sep, 19-oct] con ventana [14-oct, 26-oct].
     *
     * @return array{0: User, 1: Client, 2: Contract, 3: Printer}
     */
    private function setupArrastreContrato(array $overrides = []): array
    {
        return $this->setupClientWithContractAndPrinter(array_merge([
            'fecha_inicio' => '2026-08-20',
            'tarifa_base' => 1000,
            'paginas_incluidas' => 3000,
            'costo_pag_excedente' => 0.10,
            'dias_gracia' => 7,
        ], $overrides));
    }

    /**
     * @return array{0: User, 1: Client, 2: Contract}
     */
    private function setupClientWithContract(array $overrides = []): array
    {
        $user = $this->createUser();
        $client = $this->createClient($user);
        $contract = $this->createContract($client, $user, $overrides);

        return [$user, $client, $contract];
    }

    /**
     * @return array{0: User, 1: Client, 2: Contract, 3: Printer}
     */
    private function setupClientWithContractAndPrinter(array $overrides = []): array
    {
        [$user, $client, $contract] = $this->setupClientWithContract($overrides);
        $printer = $this->createPrinter($user);
        $this->attachPrinter($contract, $printer);

        return [$user, $client, $contract, $printer];
    }

    /**
     * Cliente con dos contratos activos (A tarifa 1000/0.01, B 500/0.015).
     *
     * @return array{0: User, 1: Client, 2: Contract, 3: Contract}
     */
    private function setupClientWithTwoContracts(array $overridesA = []): array
    {
        $user = $this->createUser();
        $client = $this->createClient($user);

        $contratoA = $this->createContract($client, $user, array_merge([
            'codigo_negocio' => 'CTR-A-' . uniqid(),
            'tarifa_base' => 1000,
            'paginas_incluidas' => 0,
            'costo_pag_excedente' => 0.01,
        ], $overridesA));
        $contratoB = $this->createContract($client, $user, array_merge([
            'codigo_negocio' => 'CTR-B-' . uniqid(),
            'tarifa_base' => 500,
            'paginas_incluidas' => 0,
            'costo_pag_excedente' => 0.015,
        ], $overridesA));

        return [$user, $client, $contratoA, $contratoB];
    }

    /**
     * Dos contratos con impresora y una lectura de 100/200 páginas en la
     * fecha dada: A -> 1000 + 100*0.01 = 1001, B -> 500 + 200*0.015 = 503.
     *
     * @return array{0: User, 1: Client, 2: Contract, 3: Contract, 4: Printer, 5: Printer, 6: Reading, 7: Reading}
     */
    private function setupClientWithTwoContractsAndReadings(string $fecha): array
    {
        [$user, $client, $contratoA, $contratoB] = $this->setupClientWithTwoContracts();

        $printerA = $this->createPrinter($user);
        $this->attachPrinter($contratoA, $printerA);
        $printerB = $this->createPrinter($user);
        $this->attachPrinter($contratoB, $printerB);

        $readingA = $this->createReading($contratoA, $printerA, $user, $fecha, 100);
        $readingB = $this->createReading($contratoB, $printerB, $user, $fecha, 200);

        return [$user, $client, $contratoA, $contratoB, $printerA, $printerB, $readingA, $readingB];
    }
}
