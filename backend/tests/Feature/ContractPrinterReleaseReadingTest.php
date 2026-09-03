<?php

namespace Tests\Feature;

use App\Enums\ContractStatus;
use App\Enums\PrinterStatus;
use App\Enums\VisitStatus;
use App\Enums\VisitType;
use App\Models\Client;
use App\Models\Contract;
use App\Models\ContractPrinter;
use App\Models\Printer;
use App\Models\PrinterBrand;
use App\Models\PrinterHistory;
use App\Models\PrinterModel;
use App\Models\Reading;
use App\Models\Role;
use App\Models\User;
use App\Models\Visit;
use App\Models\Warehouse;
use App\Services\ContractService;
use App\Services\InvoiceCalculationService;
use App\Services\InvoiceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ContractPrinterReleaseReadingTest extends TestCase
{
    use RefreshDatabase;

    private function adminUser(): User
    {
        $role = Role::create([
            'nombre' => 'Admin Test',
            'slug' => 'admin-test-' . uniqid(),
            'es_sistema' => true,
        ]);

        return User::create([
            'nombre' => 'Admin Test',
            'correo' => 'admin-' . uniqid() . '@test.com',
            'contrasena_hash' => 'password',
            'telefono' => '555-0100',
            'rol_id' => $role->id,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);
    }

    private function createClient(User $user): Client
    {
        return Client::create([
            'razon_social' => 'Cliente ' . uniqid(),
            'rfc' => strtoupper(substr(md5(uniqid()), 0, 10)),
            'nombre_contacto' => 'Contacto',
            'telefono' => '555-0200',
            'correo' => 'cliente@test.com',
            'direccion_instalacion' => 'Calle Falsa 123',
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);
    }

    private function createPrinter(User $user): Printer
    {
        $brand = PrinterBrand::firstOrCreate(['slug' => 'hp'], ['nombre' => 'HP']);
        $model = PrinterModel::firstOrCreate(
            ['brand_id' => $brand->id, 'nombre' => 'LaserJet Pro M404']
        );

        return Printer::create([
            'marca' => 'HP',
            'modelo' => 'LaserJet Pro M404',
            'printer_model_id' => $model->id,
            'num_serie' => 'SN-' . uniqid(),
            'fecha_adquisicion' => today(),
            'codigo_negocio' => 'EQ-' . uniqid(),
            'estado' => PrinterStatus::EN_ALMACEN,
            'contador_actual' => 0,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);
    }

    private function createContractWithPrinter(User $admin, Printer $printer, int $lecturaInicial): Contract
    {
        $client = $this->createClient($admin);

        $contract = Contract::create([
            'cliente_id' => $client->id,
            'codigo_negocio' => 'CTR-' . uniqid(),
            'fecha_inicio' => today()->startOfMonth()->toDateString(),
            'tarifa_base' => 1000,
            'paginas_incluidas' => 0,
            'costo_pag_excedente' => 0.01,
            'dias_gracia' => 15,
            'frecuencia_visitas' => 'MENSUAL',
            'dias_adelanto' => 7,
            'estado' => ContractStatus::ACTIVO,
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

        $contract->printers()->attach($printer->id, [
            'fecha_asignacion' => today()->startOfMonth()->toDateString(),
            'lectura_inicial' => $lecturaInicial,
            'activa' => true,
        ]);

        $printer->update(['estado' => PrinterStatus::RENTADA]);

        return $contract;
    }

    private function createVisit(Contract $contract, User $admin, string $fecha, VisitType $tipo = VisitType::RETIRO): Visit
    {
        return Visit::create([
            'cliente_id' => $contract->cliente_id,
            'contrato_id' => $contract->id,
            'tipo_visita' => $tipo,
            'fecha_programada' => $fecha,
            'socio_id' => $admin->id,
            'estado' => VisitStatus::PENDIENTE,
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);
    }

    private function createReading(Contract $contract, Printer $printer, User $admin, string $fecha, int $valor, int $paginas): Reading
    {
        $visit = $this->createVisit($contract, $admin, $fecha, VisitType::LECTURA);

        return Reading::create([
            'visita_id' => $visit->id,
            'impresora_id' => $printer->id,
            'contrato_id' => $contract->id,
            'fecha' => $fecha,
            'valor_contador' => $valor,
            'paginas_periodo' => $paginas,
            'socio_id' => $admin->id,
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);
    }

    public function test_retiro_con_lectura_crea_lectura_de_cierre_y_la_factura_la_incluye(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $contract = $this->createContractWithPrinter($admin, $printer, 100);

        $this->createReading($contract, $printer, $admin, today()->toDateString(), 200, 100);
        $printer->update(['contador_actual' => 200]);

        $warehouse = Warehouse::create(['nombre' => 'Almacén', 'direccion' => 'Calle 1']);
        $visit = $this->createVisit($contract, $admin, today()->toDateString());

        $this->postJson("/api/v1/contracts/{$contract->id}/release-printer", [
            'impresora_id' => $printer->id,
            'almacen_destino_id' => $warehouse->id,
            'visita_id' => $visit->id,
            'lectura_final' => 350,
            'motivo_liberacion' => 'SUSTITUCION_FALLA',
        ])->assertOk();

        // Lectura de cierre con delta correcto (350 - 200 = 150).
        $this->assertDatabaseHas('readings', [
            'impresora_id' => $printer->id,
            'contrato_id' => $contract->id,
            'valor_contador' => 350,
            'paginas_periodo' => 150,
        ]);

        // Pivot estampado + contador sincronizado + impresora en almacén.
        $this->assertDatabaseHas('contract_printer', [
            'contrato_id' => $contract->id,
            'impresora_id' => $printer->id,
            'activa' => false,
            'lectura_final' => 350,
            'fecha_lectura_final' => today()->toDateString(),
            'motivo_liberacion' => 'SUSTITUCION_FALLA',
        ]);
        $this->assertDatabaseHas('printers', [
            'id' => $printer->id,
            'contador_actual' => 350,
            'estado' => PrinterStatus::EN_ALMACEN->value,
            'almacen_id' => $warehouse->id,
        ]);

        $liberacion = PrinterHistory::where('impresora_id', $printer->id)
            ->where('tipo_evento', 'LIBERACION_CONTRATO')
            ->first();
        $this->assertSame(350, $liberacion->datos_adicionales['lectura_final'] ?? null);

        // Regresión clave de P2: la factura del periodo incluye la lectura de
        // cierre aunque la impresora ya no esté activa (100 + 150 = 250 pág).
        $calc = app(InvoiceCalculationService::class)->calcularEstimacion(
            $contract->cliente_id,
            today()->startOfMonth()->toDateString(),
            today()->endOfMonth()->toDateString()
        );
        $this->assertSame(250, (int) $calc['contratos'][0]['total_paginas']);

        // Y el pipeline de facturación la vincula en detalles.
        $invoice = app(InvoiceService::class)->create([
            'numero_factura' => 'F-REL-' . uniqid(),
            'cliente_id' => $contract->cliente_id,
            'fecha_emision' => today()->toDateString(),
            'fecha_vencimiento' => today()->addDays(30)->toDateString(),
            'periodo_inicio' => today()->startOfMonth()->toDateString(),
            'periodo_fin' => today()->endOfMonth()->toDateString(),
            'monto_total' => 0,
            'detalles' => [['lectura_id' => null, 'monto_calculado' => 0]],
        ], $admin);

        $this->assertSame(2, $invoice->details->whereNotNull('lectura_id')->count());
        $this->assertTrue($invoice->details->contains('paginas_consumidas', 150));
    }

    public function test_retiro_sin_lectura_sin_justificacion_es_rechazado(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $contract = $this->createContractWithPrinter($admin, $printer, 0);

        $warehouse = Warehouse::create(['nombre' => 'Almacén', 'direccion' => 'Calle 1']);

        $this->postJson("/api/v1/contracts/{$contract->id}/release-printer", [
            'impresora_id' => $printer->id,
            'almacen_destino_id' => $warehouse->id,
            'motivo_liberacion' => 'SUSTITUCION_FALLA',
        ])->assertStatus(422);

        // Falta el motivo -> también 422.
        $this->postJson("/api/v1/contracts/{$contract->id}/release-printer", [
            'impresora_id' => $printer->id,
            'almacen_destino_id' => $warehouse->id,
            'justificacion_sin_lectura' => 'Muerta',
        ])->assertStatus(422);

        $this->assertDatabaseHas('contract_printer', [
            'impresora_id' => $printer->id,
            'activa' => true,
        ]);
        $this->assertDatabaseMissing('readings', ['impresora_id' => $printer->id]);
    }

    public function test_retiro_sin_lectura_con_justificacion_registra_brecha_y_advertencia(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $contract = $this->createContractWithPrinter($admin, $printer, 0);

        $warehouse = Warehouse::create(['nombre' => 'Almacén', 'direccion' => 'Calle 1']);

        $this->postJson("/api/v1/contracts/{$contract->id}/release-printer", [
            'impresora_id' => $printer->id,
            'almacen_destino_id' => $warehouse->id,
            'motivo_liberacion' => 'SUSTITUCION_FALLA',
            'justificacion_sin_lectura' => 'Equipo muerto, panel sin respuesta',
        ])->assertOk();

        $this->assertDatabaseHas('contract_printer', [
            'impresora_id' => $printer->id,
            'activa' => false,
            'lectura_final' => null,
            'motivo_liberacion' => 'SUSTITUCION_FALLA',
            'justificacion_sin_lectura' => 'Equipo muerto, panel sin respuesta',
        ]);
        $this->assertDatabaseMissing('readings', ['impresora_id' => $printer->id]);

        $liberacion = PrinterHistory::where('impresora_id', $printer->id)
            ->where('tipo_evento', 'LIBERACION_CONTRATO')
            ->first();
        $this->assertSame(
            'Equipo muerto, panel sin respuesta',
            $liberacion->datos_adicionales['justificacion_sin_lectura'] ?? null
        );

        // La brecha es visible como advertencia en el cálculo del periodo.
        $calc = app(InvoiceCalculationService::class)->calcularEstimacion(
            $contract->cliente_id,
            today()->startOfMonth()->toDateString(),
            today()->endOfMonth()->toDateString()
        );
        $this->assertTrue(
            collect($calc['advertencias'])->contains(
                fn ($a) => str_contains($a, 'sin lectura de cierre')
                    && str_contains($a, $printer->num_serie)
            )
        );
    }

    public function test_lectura_final_menor_a_la_ultima_lectura_es_rechazada(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $contract = $this->createContractWithPrinter($admin, $printer, 100);

        $this->createReading($contract, $printer, $admin, today()->toDateString(), 500, 400);
        $printer->update(['contador_actual' => 500]);

        $warehouse = Warehouse::create(['nombre' => 'Almacén', 'direccion' => 'Calle 1']);

        $this->postJson("/api/v1/contracts/{$contract->id}/release-printer", [
            'impresora_id' => $printer->id,
            'almacen_destino_id' => $warehouse->id,
            'lectura_final' => 450,
            'motivo_liberacion' => 'SUSTITUCION_FALLA',
        ])->assertStatus(422);

        $this->assertDatabaseHas('contract_printer', [
            'impresora_id' => $printer->id,
            'activa' => true,
            'lectura_final' => null,
        ]);
        $this->assertDatabaseMissing('readings', [
            'impresora_id' => $printer->id,
            'valor_contador' => 450,
        ]);
    }

    public function test_retiro_de_impresora_sin_asignacion_activa_es_rechazado(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $contract = $this->createContractWithPrinter($admin, $printer, 0);
        $warehouse = Warehouse::create(['nombre' => 'Almacén', 'direccion' => 'Calle 1']);

        $this->postJson("/api/v1/contracts/{$contract->id}/release-printer", [
            'impresora_id' => $printer->id,
            'almacen_destino_id' => $warehouse->id,
            'motivo_liberacion' => 'OTRO',
            'justificacion_sin_lectura' => 'Prueba',
        ])->assertOk();

        // Segundo retiro de la misma impresora: ya no hay fila activa.
        $this->postJson("/api/v1/contracts/{$contract->id}/release-printer", [
            'impresora_id' => $printer->id,
            'almacen_destino_id' => $warehouse->id,
            'motivo_liberacion' => 'OTRO',
            'justificacion_sin_lectura' => 'Doble retiro',
        ])->assertStatus(422);

        $this->assertSame(
            1,
            ContractPrinter::where('impresora_id', $printer->id)->where('activa', false)->count()
        );
    }

    public function test_finish_y_cancel_estampan_motivo_y_justificacion_automaticos(): void
    {
        $admin = $this->adminUser();
        $printer1 = $this->createPrinter($admin);
        $printer2 = $this->createPrinter($admin);
        $contract1 = $this->createContractWithPrinter($admin, $printer1, 0);
        $contract2 = $this->createContractWithPrinter($admin, $printer2, 0);
        $warehouse = Warehouse::create(['nombre' => 'Almacén', 'direccion' => 'Calle 1']);

        app(ContractService::class)->finish($contract1, $warehouse->id, $admin);
        app(ContractService::class)->cancel($contract2, $warehouse->id, $admin);

        $this->assertDatabaseHas('contract_printer', [
            'impresora_id' => $printer1->id,
            'activa' => false,
            'motivo_liberacion' => 'FIN_CONTRATO',
            'justificacion_sin_lectura' => 'Liberación por finalización de contrato',
        ]);
        $this->assertDatabaseHas('contract_printer', [
            'impresora_id' => $printer2->id,
            'activa' => false,
            'motivo_liberacion' => 'CANCELACION_CONTRATO',
            'justificacion_sin_lectura' => 'Liberación por cancelación de contrato',
        ]);
    }
}
