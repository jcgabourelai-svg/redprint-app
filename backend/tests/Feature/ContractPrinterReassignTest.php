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
use App\Models\PrinterModel;
use App\Models\Role;
use App\Models\User;
use App\Models\Visit;
use App\Models\Warehouse;
use App\Services\ReadingService;
use Carbon\Carbon;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ContractPrinterReassignTest extends TestCase
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

    private function createContract(User $admin): Contract
    {
        $client = $this->createClient($admin);

        return Contract::create([
            'cliente_id' => $client->id,
            'codigo_negocio' => 'CTR-' . uniqid(),
            'fecha_inicio' => today(),
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
    }

    private function assign(Contract $contract, Printer $printer, int $lecturaInicial, ?string $alias = null, ?string $color = null): void
    {
        $contract->printers()->attach($printer->id, [
            'fecha_asignacion' => today(),
            'lectura_inicial' => $lecturaInicial,
            'activa' => true,
            'alias' => $alias,
            'color' => $color,
        ]);
        $printer->update(['estado' => PrinterStatus::RENTADA]);
    }

    private function release(Contract $contract, Printer $printer, User $admin, ?int $lecturaFinal): void
    {
        $warehouse = Warehouse::create(['nombre' => 'Almacén ' . uniqid(), 'direccion' => 'Calle 1']);

        app(\App\Services\ContractService::class)->releasePrinter(
            $contract,
            $printer,
            $warehouse->id,
            $admin,
            null,
            $lecturaFinal,
            'ROTACION',
            $lecturaFinal === null ? 'Rotación sin lectura' : null
        );
    }

    public function test_reasignar_misma_impresora_crea_segunda_fila_y_baseline_por_asignacion(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);

        // Ventana 1 (ayer): asignación, lectura del periodo y retiro con cierre.
        // (El re-ingreso real ocurre días después: el taller toma tiempo.)
        $hoyReal = today()->copy();
        Carbon::setTestNow($hoyReal->copy()->subDay()->setTime(10, 0));
        try {
            $contract = $this->createContract($admin);
            $contract->update(['fecha_inicio' => today()->toDateString()]);
            $this->assign($contract, $printer, 100, 'Recepción');

            $this->postJson('/api/v1/readings', [
                'visita_id' => Visit::create([
                    'cliente_id' => $contract->cliente_id,
                    'contrato_id' => $contract->id,
                    'tipo_visita' => 'LECTURA',
                    'fecha_programada' => today(),
                    'socio_id' => $admin->id,
                    'estado' => VisitStatus::PENDIENTE,
                    'creado_por' => $admin->id,
                    'fecha_creacion' => now(),
                ])->id,
                'impresora_id' => $printer->id,
                'contrato_id' => $contract->id,
                'fecha' => today()->toDateString(),
                'valor_contador' => 200,
            ])->assertCreated();

            $this->release($contract, $printer, $admin, 300);

            // Taller (hoy): OT completada con contador, la serie suma páginas
            // de pruebas 300 -> 380.
            Carbon::setTestNow($hoyReal->copy()->setTime(12, 0));
            $printer->update(['contador_actual' => 380, 'estado' => PrinterStatus::EN_ALMACEN]);

            // Re-ingreso de la misma impresora al mismo contrato (hoy).
            $this->postJson("/api/v1/contracts/{$contract->id}/assign-printer", [
                'impresora_id' => $printer->id,
                'lectura_inicial' => 380,
            ])->assertOk();

            // Dos ventanas del mismo par: la vieja liberada, la nueva activa.
            $this->assertSame(2, ContractPrinter::where('contrato_id', $contract->id)
                ->where('impresora_id', $printer->id)->count());
            $this->assertDatabaseHas('contract_printer', [
                'contrato_id' => $contract->id,
                'impresora_id' => $printer->id,
                'activa' => false,
                'lectura_final' => 300,
            ]);
            $this->assertDatabaseHas('contract_printer', [
                'contrato_id' => $contract->id,
                'impresora_id' => $printer->id,
                'activa' => true,
                'lectura_inicial' => 380,
            ]);

            // Baseline por asignación: la nueva ventana parte de 380, no de la
            // última lectura de la ventana anterior (300).
            $baseline = app(ReadingService::class)->getPreviousReading($printer->id, $contract->id);
            $this->assertSame(380, $baseline);

            // La primera lectura del re-ingreso factura solo el delta nuevo.
            $response = $this->postJson('/api/v1/readings', [
                'visita_id' => Visit::create([
                    'cliente_id' => $contract->cliente_id,
                    'contrato_id' => $contract->id,
                    'tipo_visita' => 'LECTURA',
                    'fecha_programada' => today(),
                    'socio_id' => $admin->id,
                    'estado' => VisitStatus::PENDIENTE,
                    'creado_por' => $admin->id,
                    'fecha_creacion' => now(),
                ])->id,
                'impresora_id' => $printer->id,
                'contrato_id' => $contract->id,
                'fecha' => today()->toDateString(),
                'valor_contador' => 450,
            ])->assertCreated();

            // 450 - 380 = 70: las 80 páginas de taller (300 -> 380) no se cobran.
            $this->assertSame(70, (int) $response->json('paginas_consumidas'));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_doble_asignacion_activa_de_la_misma_impresora_sigue_bloqueada(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $contractA = $this->createContract($admin);
        $contractB = $this->createContract($admin);
        $this->assign($contractA, $printer, 0);

        // Mismo contrato: la impresora no está en almacén -> 422.
        $this->postJson("/api/v1/contracts/{$contractA->id}/assign-printer", [
            'impresora_id' => $printer->id,
            'lectura_inicial' => 0,
        ])->assertStatus(422);

        // Contrato distinto: también bloqueado por la guardia del servicio
        // (la impresora sigue asignada al contrato A).
        $this->postJson("/api/v1/contracts/{$contractB->id}/assign-printer", [
            'impresora_id' => $printer->id,
            'lectura_inicial' => 0,
        ])->assertStatus(422);

        // Backstop a nivel BD: el índice parcial solo permite UNA fila activa
        // por par (contrato, impresora).
        $this->expectException(UniqueConstraintViolationException::class);
        DB::table('contract_printer')->insert([
            'contrato_id' => $contractA->id,
            'impresora_id' => $printer->id,
            'fecha_asignacion' => today(),
            'lectura_inicial' => 0,
            'activa' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_reemplaza_a_de_otro_contrato_es_rechazado(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $p1 = $this->createPrinter($admin);
        $p2 = $this->createPrinter($admin);
        $contractA = $this->createContract($admin);
        $contractB = $this->createContract($admin);
        $this->assign($contractA, $p1, 0);
        $this->release($contractA, $p1, $admin, null);

        $filaLiberada = ContractPrinter::where('impresora_id', $p1->id)->where('activa', false)->first();

        $this->postJson("/api/v1/contracts/{$contractB->id}/assign-printer", [
            'impresora_id' => $p2->id,
            'lectura_inicial' => 0,
            'reemplaza_a' => $filaLiberada->id,
        ])->assertStatus(422)->assertJsonPath(
            'message',
            'La asignación a reemplazar no pertenece a este contrato'
        );

        $this->assertDatabaseMissing('contract_printer', [
            'impresora_id' => $p2->id,
            'reemplaza_a' => $filaLiberada->id,
        ]);
    }

    public function test_reemplaza_a_de_fila_activa_es_rechazado(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $p1 = $this->createPrinter($admin);
        $p2 = $this->createPrinter($admin);
        $contract = $this->createContract($admin);
        $this->assign($contract, $p1, 0);

        $filaActiva = ContractPrinter::where('impresora_id', $p1->id)->where('activa', true)->first();

        $this->postJson("/api/v1/contracts/{$contract->id}/assign-printer", [
            'impresora_id' => $p2->id,
            'lectura_inicial' => 0,
            'reemplaza_a' => $filaActiva->id,
        ])->assertStatus(422)->assertJsonPath(
            'message',
            'La asignación a reemplazar debe estar liberada'
        );
    }

    public function test_reemplaza_a_ya_enlazada_es_rechazado(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $p1 = $this->createPrinter($admin);
        $p2 = $this->createPrinter($admin);
        $p3 = $this->createPrinter($admin);
        $contract = $this->createContract($admin);
        $this->assign($contract, $p1, 0);
        $this->release($contract, $p1, $admin, null);

        $filaLiberada = ContractPrinter::where('impresora_id', $p1->id)->where('activa', false)->first();

        // Primera instalación enlazada a la fila liberada: aceptada.
        $this->postJson("/api/v1/contracts/{$contract->id}/assign-printer", [
            'impresora_id' => $p2->id,
            'lectura_inicial' => 0,
            'reemplaza_a' => $filaLiberada->id,
        ])->assertOk();

        // Segunda instalación apuntando a la misma fila: 422 accionable.
        $this->postJson("/api/v1/contracts/{$contract->id}/assign-printer", [
            'impresora_id' => $p3->id,
            'lectura_inicial' => 0,
            'reemplaza_a' => $filaLiberada->id,
        ])->assertStatus(422)->assertJsonPath(
            'message',
            'La asignación indicada ya fue reemplazada por otra instalación'
        );

        $this->assertDatabaseMissing('contract_printer', [
            'impresora_id' => $p3->id,
            'reemplaza_a' => $filaLiberada->id,
        ]);

        // Backstop a nivel BD: el índice parcial garantiza que una fila
        // liberada no pueda ser referida por dos reemplaza_a.
        $this->expectException(UniqueConstraintViolationException::class);
        DB::table('contract_printer')->insert([
            'contrato_id' => $contract->id,
            'impresora_id' => $p3->id,
            'fecha_asignacion' => today(),
            'lectura_inicial' => 0,
            'activa' => true,
            'reemplaza_a' => $filaLiberada->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_reemplaza_a_valido_hereda_alias_y_color_y_estampa_enlace(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $p1 = $this->createPrinter($admin);
        $p2 = $this->createPrinter($admin);
        $contract = $this->createContract($admin);
        $this->assign($contract, $p1, 0, 'Recepción', 'morado');
        $this->release($contract, $p1, $admin, 500);

        $filaLiberada = ContractPrinter::where('impresora_id', $p1->id)->where('activa', false)->first();
        $p2->update(['contador_actual' => 1000]);

        $this->postJson("/api/v1/contracts/{$contract->id}/assign-printer", [
            'impresora_id' => $p2->id,
            'lectura_inicial' => 1000,
            'reemplaza_a' => $filaLiberada->id,
        ])->assertOk();

        $nueva = ContractPrinter::where('impresora_id', $p2->id)->where('activa', true)->first();
        $this->assertSame($filaLiberada->id, $nueva->reemplaza_a);
        $this->assertSame('Recepción', $nueva->alias);
        $this->assertSame($filaLiberada->color, $nueva->color);

        // El resource expone el enlace en ambas direcciones (show carga
        // maintenanceOrders y por eso incluye `impresoras`).
        $impresoras = collect($this->getJson("/api/v1/contracts/{$contract->id}")->assertOk()->json('impresoras'));
        $nuevaData = $impresoras->firstWhere('impresora_id', $p2->id);
        $viejaData = $impresoras->firstWhere('impresora_id', $p1->id);
        $this->assertSame($filaLiberada->id, $nuevaData['reemplaza_a']);
        $this->assertSame($nueva->id, $viejaData['reemplazada_por_id']);
        $this->assertSame($p2->id, $viejaData['reemplazada_por_impresora_id']);
    }

    public function test_alias_explicito_prevalece_sobre_la_herencia(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $p1 = $this->createPrinter($admin);
        $p2 = $this->createPrinter($admin);
        $contract = $this->createContract($admin);
        $this->assign($contract, $p1, 0, 'Recepción');
        $this->release($contract, $p1, $admin, null);

        $filaLiberada = ContractPrinter::where('impresora_id', $p1->id)->where('activa', false)->first();

        $this->postJson("/api/v1/contracts/{$contract->id}/assign-printer", [
            'impresora_id' => $p2->id,
            'lectura_inicial' => 0,
            'alias' => 'Dirección',
            'reemplaza_a' => $filaLiberada->id,
        ])->assertOk();

        $this->assertDatabaseHas('contract_printer', [
            'impresora_id' => $p2->id,
            'activa' => true,
            'alias' => 'Dirección',
            'reemplaza_a' => $filaLiberada->id,
        ]);
    }
}
