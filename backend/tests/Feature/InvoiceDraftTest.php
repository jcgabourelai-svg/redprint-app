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
use App\Services\InvoiceCalculationService;
use App\Services\InvoiceService;
use App\Services\PaymentService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InvoiceDraftTest extends TestCase
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

    /**
     * Escenario base: cliente con contrato activo, una impresora y una
     * lectura de 700 paginas en junio (monto esperado 1502.00).
     *
     * @return array{0: User, 1: Client, 2: Contract, 3: Printer, 4: Reading}
     */
    private function setupDraftScenario(array $clientOverrides = []): array
    {
        $user = $this->createUser();
        $client = $this->createClient($user, $clientOverrides);
        $contract = $this->createContract($client, $user);
        $printer = $this->createPrinter($user);
        $this->attachPrinter($contract, $printer);
        $reading = $this->createReading($contract, $printer, $user, '2026-06-05', 700);

        return [$user, $client, $contract, $printer, $reading];
    }

    private function draftPayload(Client $client): array
    {
        return [
            'cliente_id' => $client->id,
            'periodo_inicio' => '2026-06-01',
            'periodo_fin' => '2026-06-30',
        ];
    }

    public function test_create_draft_crea_borrador_sin_folio_y_no_cuenta_en_saldos(): void
    {
        [$user, $client, , , $reading] = $this->setupDraftScenario();

        $result = app(InvoiceService::class)->createDraft($this->draftPayload($client), $user);
        $invoice = $result['invoice'];

        $this->assertSame(\App\Enums\InvoiceStatus::BORRADOR, $invoice->estado);
        $this->assertNull($invoice->numero_factura);
        $this->assertNull($invoice->fecha_emision);
        $this->assertNull($invoice->fecha_vencimiento);
        $this->assertEquals(0.0, (float) $invoice->saldo_pendiente);
        $this->assertEquals(1502.0, (float) $invoice->monto_total);
        $this->assertNotNull($invoice->details->firstWhere('lectura_id', $reading->id));

        // El borrador NO es cuenta por cobrar: queda fuera del saldo.
        $this->assertEquals(0.0, app(InvoiceService::class)->getOutstandingBalance($client->id));
    }

    public function test_create_draft_sin_contratos_activos_lanza_excepcion(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);

        $this->expectException(BusinessRuleException::class);
        $this->expectExceptionMessage('captura directa');

        app(InvoiceService::class)->createDraft($this->draftPayload($client), $user);
    }

    public function test_emitir_sin_folio_o_con_folio_duplicado_lanza_excepcion(): void
    {
        [$user, $client] = $this->setupDraftScenario();
        $service = app(InvoiceService::class);

        $draft = $service->createDraft($this->draftPayload($client), $user)['invoice'];

        try {
            $service->emitir($draft, ['fecha_emision' => '2026-06-10']);
            $this->fail('Emitir sin folio debio lanzar BusinessRuleException.');
        } catch (BusinessRuleException $e) {
            $this->assertStringContainsString('numero de factura', $e->getMessage());
        }

        // Factura emitida previa que ya ocupa el folio.
        Invoice::create([
            'numero_factura' => 'F-DUP-001',
            'cliente_id' => $client->id,
            'fecha_emision' => '2026-05-10',
            'fecha_vencimiento' => '2026-06-10',
            'monto_total' => 100,
            'monto_pagado' => 0,
            'saldo_pendiente' => 100,
            'estado' => 'PENDIENTE',
            'socio_id' => $user->id,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);

        $this->expectException(BusinessRuleException::class);
        $this->expectExceptionMessage('Ya existe una factura');

        $service->emitir($draft, ['numero_factura' => 'F-DUP-001', 'fecha_emision' => '2026-06-10']);
    }

    public function test_emitir_valido_pasa_a_pendiente_y_deriva_vencimiento(): void
    {
        // Cliente con 15 dias de credito: vencimiento = emision + 15.
        [$user, $client] = $this->setupDraftScenario(['dias_credito' => 15]);
        $service = app(InvoiceService::class);

        $draft = $service->createDraft($this->draftPayload($client), $user)['invoice'];
        $emitida = $service->emitir($draft, ['numero_factura' => 'F-EMIT-001', 'fecha_emision' => '2026-07-10']);

        $this->assertSame(\App\Enums\InvoiceStatus::PENDIENTE, $emitida->estado);
        $this->assertSame('F-EMIT-001', $emitida->numero_factura);
        $this->assertEquals('2026-07-25', $emitida->fecha_vencimiento?->toDateString());
        $this->assertEquals((float) $emitida->monto_total, (float) $emitida->saldo_pendiente);
        // El default del cliente sin dias_credito explicito es 30.
        $this->assertEquals(15, $client->fresh()->dias_credito);
    }

    public function test_emitir_derivacion_por_defecto_es_30_dias(): void
    {
        [$user, $client] = $this->setupDraftScenario();
        $service = app(InvoiceService::class);

        $draft = $service->createDraft($this->draftPayload($client), $user)['invoice'];
        $emitida = $service->emitir($draft, ['numero_factura' => 'F-EMIT-002', 'fecha_emision' => '2026-07-10']);

        $this->assertEquals('2026-08-09', $emitida->fecha_vencimiento?->toDateString());
    }

    public function test_dos_borradores_del_mismo_periodo_se_bloquean(): void
    {
        [$user, $client, , , $reading] = $this->setupDraftScenario();
        $service = app(InvoiceService::class);

        $first = $service->createDraft($this->draftPayload($client), $user)['invoice'];
        $this->assertNotNull($first->details->firstWhere('lectura_id', $reading->id));

        // Bloqueo duro (D20): un segundo borrador del mismo periodo para el
        // mismo alcance ya no se crea (antes caia a renta base).
        $this->expectException(BusinessRuleException::class);
        $this->expectExceptionMessage('No se puede facturar dos veces');

        $service->createDraft($this->draftPayload($client), $user);
    }

    public function test_indice_unico_impide_duplicar_detalle_de_lectura(): void
    {
        [$user, $client, $contract, $printer, $reading] = $this->setupDraftScenario();
        $service = app(InvoiceService::class);

        $first = $service->createDraft($this->draftPayload($client), $user)['invoice'];
        $this->assertNotNull($first->details->firstWhere('lectura_id', $reading->id));

        // La garantia dura es la BD: el indice unico parcial sobre
        // invoice_details.lectura_id rechaza cualquier detalle duplicado
        // (el helper del servicio lo traduce a BusinessRuleException 422).
        $this->expectException(QueryException::class);
        InvoiceDetail::create([
            'factura_id' => $first->id,
            'contrato_id' => $contract->id,
            'impresora_id' => $printer->id,
            'lectura_id' => $reading->id,
            'paginas_consumidas' => 700,
            'monto_calculado' => 1502,
        ]);
    }

    public function test_recalcular_actualiza_monto_y_detalles_con_lecturas_nuevas(): void
    {
        [$user, $client, $contract, $printer, $reading1] = $this->setupDraftScenario();
        $service = app(InvoiceService::class);

        $draft = $service->createDraft($this->draftPayload($client), $user)['invoice'];
        $this->assertEquals(1502.0, (float) $draft->monto_total);

        // Llega una lectura nueva dentro del periodo: 1000 paginas mas.
        $this->createReading($contract, $printer, $user, '2026-06-20', 1000);

        $result = $service->recalcular($draft);
        $recalculada = $result['invoice'];

        // 700 + 1000 = 1700 pag -> 1500 + 1200 * 0.01 = 1512.00
        $this->assertEquals(1512.0, (float) $recalculada->monto_total);
        $this->assertCount(2, $recalculada->details);
        $this->assertNotNull($recalculada->details->firstWhere('lectura_id', $reading1->id));

        // El recálculo no se advierte a si mismo como periodo solapado.
        $this->assertEmpty(array_filter(
            $result['advertencias'],
            fn ($a) => str_contains($a, 'se solapa')
        ));
    }

    public function test_destroy_borrador_libera_lecturas_y_rechaza_emitidas(): void
    {
        [$user, $client] = $this->setupDraftScenario();
        $service = app(InvoiceService::class);

        $draft = $service->createDraft($this->draftPayload($client), $user)['invoice'];

        $service->destroy($draft);
        $this->assertNull(Invoice::find($draft->id));

        // La lectura vuelve a ser facturable: un borrador nuevo la reserva.
        $nuevo = $service->createDraft($this->draftPayload($client), $user)['invoice'];
        $this->assertEquals(1502.0, (float) $nuevo->monto_total);

        // Una factura emitida NO se puede eliminar.
        $emitida = $service->emitir($nuevo, ['numero_factura' => 'F-DEL-001', 'fecha_emision' => '2026-07-01']);
        $this->expectException(BusinessRuleException::class);
        $service->destroy($emitida);
    }

    public function test_pago_sobre_borrador_es_rechazado(): void
    {
        [$user, $client] = $this->setupDraftScenario();
        $service = app(InvoiceService::class);

        $draft = $service->createDraft($this->draftPayload($client), $user)['invoice'];

        $this->expectException(BusinessRuleException::class);
        $this->expectExceptionMessage('BORRADOR');

        app(PaymentService::class)->registerPayment([
            'factura_id' => $draft->id,
            'fecha' => '2026-06-15',
            'monto' => 100,
            'metodo_pago' => 'EFECTIVO',
        ], $user);
    }

    public function test_captura_directa_ignora_vencimiento_del_payload_y_deriva_del_cliente(): void
    {
        [$user, $client] = $this->setupDraftScenario(['dias_credito' => 45]);
        $service = app(InvoiceService::class);

        $invoice = $service->create([
            'numero_factura' => 'F-DIRECTA-001',
            'cliente_id' => $client->id,
            'fecha_emision' => '2026-06-10',
            // Payload malicioso/obsoleto: debe ignorarse.
            'fecha_vencimiento' => '2026-12-31',
            'monto_total' => 500,
        ], $user);

        $this->assertEquals('2026-07-25', $invoice->fecha_vencimiento?->toDateString());
    }

    public function test_index_excluye_borradores_salvo_filtro_explicito(): void
    {
        [$user, $client] = $this->setupDraftScenario();
        $service = app(InvoiceService::class);

        $service->createDraft($this->draftPayload($client), $user);
        $service->create([
            'numero_factura' => 'F-LIST-001',
            'cliente_id' => $client->id,
            'fecha_emision' => '2026-06-10',
            'monto_total' => 100,
        ], $user);

        $role = Role::create([
            'nombre' => 'Administrador Test',
            'slug' => 'administrador-test',
            'descripcion' => 'Rol sistema para pruebas',
            'es_sistema' => true,
        ]);
        $user->update(['rol_id' => $role->id]);
        Sanctum::actingAs($user->fresh());

        $sinFiltro = $this->getJson('/api/v1/invoices');
        $sinFiltro->assertOk();
        $this->assertCount(1, $sinFiltro->json('data'));
        $this->assertSame('F-LIST-001', $sinFiltro->json('data.0.numero_factura'));

        $conFiltro = $this->getJson('/api/v1/invoices?estado=BORRADOR');
        $conFiltro->assertOk();
        $this->assertCount(1, $conFiltro->json('data'));
        $this->assertSame('BORRADOR', $conFiltro->json('data.0.estado'));
        $this->assertNull($conFiltro->json('data.0.numero_factura'));
    }

    public function test_calcular_advierte_periodo_solapado(): void
    {
        [$user, $client] = $this->setupDraftScenario();

        // Factura ya emitida sobre la primera quincena de junio.
        Invoice::create([
            'numero_factura' => 'F-SOLAP-001',
            'cliente_id' => $client->id,
            'fecha_emision' => '2026-06-15',
            'fecha_vencimiento' => '2026-07-15',
            'periodo_inicio' => '2026-06-01',
            'periodo_fin' => '2026-06-15',
            'monto_total' => 100,
            'monto_pagado' => 0,
            'saldo_pendiente' => 100,
            'estado' => 'PENDIENTE',
            'socio_id' => $user->id,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);

        $result = app(InvoiceCalculationService::class)
            ->calcularEstimacion($client->id, '2026-06-01', '2026-06-30');

        $solapamiento = array_filter($result['advertencias'], fn ($a) => str_contains($a, 'se solapa'));
        $this->assertNotEmpty($solapamiento);
        $this->assertStringContainsString('F-SOLAP-001', implode(' ', $solapamiento));
    }

    public function test_recalcular_sin_monto_lanza_excepcion_y_conserva_detalles(): void
    {
        [$user, $client, , , $reading] = $this->setupDraftScenario();
        $service = app(InvoiceService::class);

        $draft = $service->createDraft($this->draftPayload($client), $user)['invoice'];
        $detallesOriginales = $draft->details->count();
        $this->assertGreaterThan(0, $detallesOriginales);

        // El contrato se desactiva: el recalculo del borrador mono-contrato
        // se rechaza con diagnostico explicito (guarda de contrato activo).
        $client->contracts()->update(['estado' => ContractStatus::SUSPENDIDO]);

        try {
            $service->recalcular($draft);
            $this->fail('Recalcular sin monto debio lanzar BusinessRuleException.');
        } catch (BusinessRuleException $e) {
            $this->assertStringContainsString('no está activo', $e->getMessage());
        }

        // La excepcion revierte la transaccion: los detalles originales
        // (y la reserva de la lectura) quedan intactos.
        $this->assertEquals($detallesOriginales, $draft->details()->count());
        $this->assertNotNull($draft->details()->where('lectura_id', $reading->id)->first());
    }

    public function test_emitir_borrador_sin_monto_lanza_excepcion(): void
    {
        [$user, $client] = $this->setupDraftScenario();
        $service = app(InvoiceService::class);

        $draft = $service->createDraft($this->draftPayload($client), $user)['invoice'];

        // Forzar un borrador en 0 (p. ej. por datos legacy) no debe poder
        // emitirse: consumiria un folio real con saldo 0.
        $draft->update(['monto_total' => 0]);

        $this->expectException(BusinessRuleException::class);
        $this->expectExceptionMessage('no tiene monto');

        $service->emitir($draft, ['numero_factura' => 'F-ZERO-001', 'fecha_emision' => '2026-07-10']);
    }
}
