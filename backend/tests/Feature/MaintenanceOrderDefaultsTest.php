<?php

namespace Tests\Feature;

use App\Enums\ContractStatus;
use App\Enums\PrinterStatus;
use App\Enums\VisitStatus;
use App\Enums\VisitType;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Printer;
use App\Models\PrinterBrand;
use App\Models\PrinterModel;
use App\Models\Role;
use App\Models\User;
use App\Models\Visit;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MaintenanceOrderDefaultsTest extends TestCase
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

    private function createPrinter(User $user, array $overrides = []): Printer
    {
        $brand = PrinterBrand::firstOrCreate(['slug' => 'hp'], ['nombre' => 'HP']);
        $model = PrinterModel::firstOrCreate(
            ['brand_id' => $brand->id, 'nombre' => 'LaserJet Pro M404']
        );

        return Printer::create(array_merge([
            'marca' => 'HP',
            'modelo' => 'LaserJet Pro M404',
            'printer_model_id' => $model->id,
            'num_serie' => 'SN-' . uniqid(),
            'fecha_adquisicion' => today(),
            'codigo_negocio' => 'EQ-' . uniqid(),
            'estado' => PrinterStatus::EN_ALMACEN,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ], $overrides));
    }

    private function createContractWithPrinter(User $admin, Printer $printer): Contract
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
            'lectura_inicial' => 0,
            'activa' => true,
        ]);

        $printer->update(['estado' => PrinterStatus::RENTADA]);

        return $contract;
    }

    public function test_store_sin_fecha_la_estampa_con_hoy(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);

        $response = $this->postJson('/api/v1/maintenance-orders', [
            'impresora_id' => $printer->id,
            'tipo_mantto' => 'CORRECTIVO',
            'desc_problema' => 'No imprime desde esta manana',
        ]);

        $response->assertCreated()->assertJsonPath('fecha', today()->toDateString());

        $this->assertDatabaseHas('maintenance_orders', [
            'id' => $response->json('id'),
            'fecha' => today()->toDateString(),
        ]);
    }

    public function test_show_expone_ubicacion_y_proxima_visita(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        // Rentada con contrato activo y visita pendiente futura: piso + próxima visita.
        $rentada = $this->createPrinter($admin);
        $contract = $this->createContractWithPrinter($admin, $rentada);

        $ordenPiso = $this->postJson('/api/v1/maintenance-orders', [
            'impresora_id' => $rentada->id,
            'tipo_mantto' => 'PREVENTIVO',
            'desc_problema' => 'Servicio preventivo programado',
        ])->assertCreated()->json('id');

        $fechaVisita = today()->addDays(10);
        Visit::create([
            'cliente_id' => $contract->cliente_id,
            'contrato_id' => $contract->id,
            'tipo_visita' => VisitType::LECTURA,
            'fecha_programada' => $fechaVisita,
            'socio_id' => $admin->id,
            'estado' => VisitStatus::PENDIENTE,
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

        $this->getJson("/api/v1/maintenance-orders/{$ordenPiso}")
            ->assertOk()
            ->assertJsonPath('printer.cliente.nombre', $contract->client->razon_social)
            ->assertJsonPath('printer.cliente.contrato_id', $contract->id)
            ->assertJsonPath('proxima_visita.fecha_programada', $fechaVisita->toDateString())
            ->assertJsonPath('proxima_visita.tipo_visita', 'LECTURA');

        // En almacén con almacén asignado: taller, sin próxima visita.
        $warehouse = Warehouse::create(['nombre' => 'Almacén Central', 'direccion' => 'Calle 1']);
        $almacenada = $this->createPrinter($admin, ['almacen_id' => $warehouse->id]);

        $ordenTaller = $this->postJson('/api/v1/maintenance-orders', [
            'impresora_id' => $almacenada->id,
            'tipo_mantto' => 'CORRECTIVO',
            'desc_problema' => 'Atasco de papel recurrente',
        ])->assertCreated()->json('id');

        $this->getJson("/api/v1/maintenance-orders/{$ordenTaller}")
            ->assertOk()
            ->assertJsonPath('printer.warehouse.nombre', 'Almacén Central')
            ->assertJsonPath('printer.cliente', null)
            ->assertJsonPath('proxima_visita', null);
    }
}
