<?php

namespace Tests\Feature;

use App\Enums\ContractStatus;
use App\Enums\PrinterStatus;
use App\Enums\VisitStatus;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Printer;
use App\Models\PrinterBrand;
use App\Models\PrinterModel;
use App\Models\Reading;
use App\Models\Role;
use App\Models\User;
use App\Models\Visit;
use App\Services\ReadingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReadingAnomalyThresholdTest extends TestCase
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

    private function setupContractWithPrinter(User $admin, int $lecturaInicial): array
    {
        $client = Client::create([
            'razon_social' => 'Cliente ' . uniqid(),
            'rfc' => strtoupper(substr(md5(uniqid()), 0, 10)),
            'nombre_contacto' => 'Contacto',
            'telefono' => '555-0200',
            'correo' => 'cliente@test.com',
            'direccion_instalacion' => 'Calle Falsa 123',
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

        $brand = PrinterBrand::firstOrCreate(['slug' => 'hp'], ['nombre' => 'HP']);
        $model = PrinterModel::firstOrCreate(
            ['brand_id' => $brand->id, 'nombre' => 'LaserJet Pro M404']
        );

        $printer = Printer::create([
            'marca' => 'HP',
            'modelo' => 'LaserJet Pro M404',
            'printer_model_id' => $model->id,
            'num_serie' => 'SN-' . uniqid(),
            'fecha_adquisicion' => today(),
            'codigo_negocio' => 'EQ-' . uniqid(),
            'estado' => PrinterStatus::RENTADA,
            'contador_actual' => $lecturaInicial,
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

        $contract = Contract::create([
            'cliente_id' => $client->id,
            'codigo_negocio' => 'CTR-' . uniqid(),
            'fecha_inicio' => today()->subDays(30),
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
            'fecha_asignacion' => today()->subDays(30),
            'lectura_inicial' => $lecturaInicial,
            'activa' => true,
        ]);

        return [$contract, $printer];
    }

    private function seedReadings(Contract $contract, Printer $printer, User $admin, array $paginas): void
    {
        $valor = (int) $contract->printers()->first()->pivot->lectura_inicial;
        foreach ($paginas as $i => $delta) {
            $valor += $delta;
            $visit = Visit::create([
                'cliente_id' => $contract->cliente_id,
                'contrato_id' => $contract->id,
                'tipo_visita' => 'LECTURA',
                'fecha_programada' => today()->subDays(30 - 7 * $i),
                'socio_id' => $admin->id,
                'estado' => VisitStatus::COMPLETADA,
                'creado_por' => $admin->id,
                'fecha_creacion' => now(),
            ]);

            Reading::create([
                'visita_id' => $visit->id,
                'impresora_id' => $printer->id,
                'contrato_id' => $contract->id,
                'fecha' => today()->subDays(30 - 7 * $i),
                'valor_contador' => $valor,
                'paginas_periodo' => $delta,
                'socio_id' => $admin->id,
                'creado_por' => $admin->id,
                'fecha_creacion' => now(),
            ]);
        }

        $printer->update(['contador_actual' => $valor]);
    }

    private function capturar(User $admin, Contract $contract, Printer $printer, int $valor, ?string $justificacion = null)
    {
        $visit = Visit::create([
            'cliente_id' => $contract->cliente_id,
            'contrato_id' => $contract->id,
            'tipo_visita' => 'LECTURA',
            'fecha_programada' => today(),
            'socio_id' => $admin->id,
            'estado' => VisitStatus::PENDIENTE,
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

        return $this->postJson('/api/v1/readings', [
            'visita_id' => $visit->id,
            'impresora_id' => $printer->id,
            'contrato_id' => $contract->id,
            'fecha' => today()->toDateString(),
            'valor_contador' => $valor,
            'justificacion_anomalia' => $justificacion,
        ]);
    }

    public function test_delta_gigante_con_historial_exige_justificacion(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 1000);

        // 3 lecturas previas: max delta 600 -> umbral max(1200, 5000) = 5000.
        $this->seedReadings($contract, $printer, $admin, [400, 600, 500]);
        $ultimoValor = $printer->fresh()->contador_actual;

        // Delta 6000 > 5000 sin justificación -> 422.
        $this->capturar($admin, $contract, $printer, $ultimoValor + 6000)
            ->assertStatus(422);

        // Con justificación pasa y queda marcada como anomalía.
        $response = $this->capturar($admin, $contract, $printer, $ultimoValor + 6000, 'Cliente imprimió volantes de campaña nacional')
            ->assertCreated();

        $this->assertTrue((bool) $response->json('reading.es_anomalia'));
        $this->assertSame(6000, (int) $response->json('reading.paginas_periodo'));
    }

    public function test_delta_dentro_del_umbral_no_exige_justificacion(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 1000);

        // max delta 600 -> umbral 5000. Delta 4000 <= umbral: normal.
        $this->seedReadings($contract, $printer, $admin, [400, 600, 500]);
        $ultimoValor = $printer->fresh()->contador_actual;

        $response = $this->capturar($admin, $contract, $printer, $ultimoValor + 4000)
            ->assertCreated();

        $this->assertFalse((bool) $response->json('reading.es_anomalia'));
    }

    public function test_con_menos_de_tres_lecturas_no_hay_umbral(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 1000);

        // Solo 2 lecturas previas: sin historial suficiente no hay umbral.
        $this->seedReadings($contract, $printer, $admin, [100, 150]);
        $ultimoValor = $printer->fresh()->contador_actual;

        $this->assertNull(app(ReadingService::class)->umbralAnomalia($contract->id));

        $response = $this->capturar($admin, $contract, $printer, $ultimoValor + 50000)
            ->assertCreated();

        $this->assertFalse((bool) $response->json('reading.es_anomalia'));
    }

    public function test_umbral_es_el_maximo_entre_doble_del_historico_y_5000(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 0);

        // Deltas grandes: max 4000 -> umbral max(8000, 5000) = 8000.
        $this->seedReadings($contract, $printer, $admin, [3000, 4000, 3500]);

        $this->assertSame(8000, app(ReadingService::class)->umbralAnomalia($contract->id));
    }

    public function test_umbral_se_expone_en_el_payload_de_captura_movil(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 1000);
        $this->seedReadings($contract, $printer, $admin, [400, 600, 500]);

        $visit = Visit::create([
            'cliente_id' => $contract->cliente_id,
            'contrato_id' => $contract->id,
            'tipo_visita' => 'LECTURA',
            'fecha_programada' => today(),
            'socio_id' => $admin->id,
            'estado' => VisitStatus::PENDIENTE,
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

        $response = $this->getJson("/api/v1/visits/{$visit->id}")->assertOk();

        $impresora = collect($response->json('impresoras'))
            ->firstWhere('impresora_id', (string) $printer->id);

        $this->assertNotNull($impresora);
        $this->assertSame(5000, $impresora['umbral_anomalia']);
    }
}
