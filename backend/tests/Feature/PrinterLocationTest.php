<?php

namespace Tests\Feature;

use App\Enums\ContractStatus;
use App\Enums\PrinterStatus;
use App\Models\Client;
use App\Models\Contract;
use App\Models\ContractPrinter;
use App\Models\Printer;
use App\Models\PrinterBrand;
use App\Models\PrinterModel;
use App\Models\Role;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PrinterLocationTest extends TestCase
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

    private function createClient(User $user, string $razonSocial): Client
    {
        return Client::create([
            'razon_social' => $razonSocial,
            'rfc' => strtoupper(substr(md5($razonSocial), 0, 10)),
            'nombre_contacto' => 'Contacto',
            'telefono' => '555-0200',
            'correo' => 'cliente@test.com',
            'direccion_instalacion' => 'Calle Falsa 123',
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);
    }

    private function createPrinter(User $user, array $attrs = []): Printer
    {
        $brand = PrinterBrand::firstOrCreate(
            ['slug' => 'hp'],
            ['nombre' => 'HP']
        );
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
            'contador_actual' => 0,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ], $attrs));
    }

    public function test_impresora_rentada_expone_cliente_del_contrato_activo(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $client = $this->createClient($admin, 'Tortas Don Beto SA');
        $contract = Contract::create([
            'cliente_id' => $client->id,
            'codigo_negocio' => 'CTR-' . uniqid(),
            'fecha_inicio' => today(),
            'tarifa_base' => 1500,
            'frecuencia_visitas' => 'MENSUAL',
            'estado' => ContractStatus::ACTIVO,
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

        $rented = $this->createPrinter($admin, ['estado' => PrinterStatus::RENTADA]);
        ContractPrinter::create([
            'contrato_id' => $contract->id,
            'impresora_id' => $rented->id,
            'fecha_asignacion' => today(),
            'activa' => true,
            'lectura_inicial' => 0,
        ]);

        $response = $this->getJson('/api/v1/printers');

        $response->assertOk();
        $row = collect($response->json('data'))->firstWhere('id', $rented->id);

        $this->assertNotNull($row);
        $this->assertSame('Tortas Don Beto SA', $row['cliente']['nombre']);
        $this->assertSame($contract->codigo_negocio, $row['cliente']['contrato_codigo']);
    }

    public function test_impresora_libera_cliente_al_desactivar_asignacion(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $client = $this->createClient($admin, 'Cliente Fantasma');
        $contract = Contract::create([
            'cliente_id' => $client->id,
            'codigo_negocio' => 'CTR-' . uniqid(),
            'fecha_inicio' => today(),
            'tarifa_base' => 1500,
            'frecuencia_visitas' => 'MENSUAL',
            'estado' => ContractStatus::ACTIVO,
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

        $printer = $this->createPrinter($admin, ['estado' => PrinterStatus::EN_ALMACEN]);
        ContractPrinter::create([
            'contrato_id' => $contract->id,
            'impresora_id' => $printer->id,
            'fecha_asignacion' => today()->subMonth(),
            'fecha_liberacion' => today(),
            'activa' => false,
            'lectura_inicial' => 0,
        ]);

        $response = $this->getJson('/api/v1/printers');

        $response->assertOk();
        $row = collect($response->json('data'))->firstWhere('id', $printer->id);

        $this->assertNotNull($row);
        $this->assertNull($row['cliente']);
    }

    public function test_impresora_en_almacen_muestra_almacen_y_cliente_nulo(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $warehouse = Warehouse::create([
            'nombre' => 'Local Principal',
            'direccion' => 'Av. Principal 100',
        ]);
        $printer = $this->createPrinter($admin, ['almacen_id' => $warehouse->id]);

        $response = $this->getJson('/api/v1/printers');

        $response->assertOk();
        $row = collect($response->json('data'))->firstWhere('id', $printer->id);

        $this->assertNotNull($row);
        $this->assertSame('Local Principal', $row['warehouse']['nombre']);
        $this->assertNull($row['cliente']);
    }
}
