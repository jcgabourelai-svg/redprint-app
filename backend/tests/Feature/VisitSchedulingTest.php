<?php

namespace Tests\Feature;

use App\Enums\ContractStatus;
use App\Enums\VisitFrequency;
use App\Enums\VisitStatus;
use App\Enums\VisitType;
use App\Models\Client;
use App\Models\Contract;
use App\Models\User;
use App\Models\Visit;
use App\Services\VisitSchedulerService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VisitSchedulingTest extends TestCase
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

    public function test_genera_primera_visita_al_crear_contrato(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 6, 10));
        try {
            $user = $this->createUser();
            $client = $this->createClient($user);
            $contract = $this->createContract($client, $user, [
                'frecuencia_visitas' => VisitFrequency::MENSUAL,
                'dia_visita' => 15,
            ]);

            $service = app(VisitSchedulerService::class);
            $visit = $service->generateNextCycle($contract, $user->id);

            $this->assertNotNull($visit, 'Se esperaba que se generara la primera visita');

            // 10 de junio: el dia 15 aun no ha pasado -> visita el 15 de junio.
            $this->assertEquals('2026-06-15', $visit->fecha_programada->toDateString());
            $this->assertEquals(VisitStatus::PENDIENTE, $visit->estado);
            $this->assertEquals(VisitType::LECTURA, $visit->tipo_visita);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_es_idempotente_y_no_duplica_visitas(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);
        $contract = $this->createContract($client, $user, ['dia_visita' => 20]);

        $service = app(VisitSchedulerService::class);

        $first = $service->generateNextCycle($contract, $user->id);
        $this->assertNotNull($first);

        // Segunda invocacion: ya existe visita pendiente en la ventana -> null.
        $second = $service->generateNextCycle($contract, $user->id);
        $this->assertNull($second);

        $this->assertEquals(1, Visit::where('contrato_id', $contract->id)->count());
    }

    public function test_marca_visitas_futuras_como_cancelada_al_cancelar_contrato(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);
        $contract = $this->createContract($client, $user, ['dia_visita' => 12]);

        $service = app(VisitSchedulerService::class);
        $service->generateNextCycle($contract, $user->id);

        $cancelled = $service->cancelFutureVisits($contract);

        $this->assertGreaterThanOrEqual(1, $cancelled);
        $this->assertEquals(
            0,
            Visit::where('contrato_id', $contract->id)
                ->where('estado', VisitStatus::PENDIENTE)
                ->count()
        );
        $this->assertGreaterThan(
            0,
            Visit::where('contrato_id', $contract->id)
                ->where('estado', VisitStatus::CANCELADA)
                ->count()
        );
    }

    public function test_clamp_de_mes_corto_para_dia_31(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);
        $contract = $this->createContract($client, $user, ['dia_visita' => 31]);

        $service = app(VisitSchedulerService::class);

        // Simular referencia en febrero (mes corto, 2026 no bisiesto).
        Carbon::setTestNow(Carbon::create(2026, 2, 5));
        try {
            $next = $service->computeNextVisitDate($contract, today());
            $this->assertEquals('2026-02-28', $next->toDateString());
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_no_genera_para_contrato_cancelado(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user);
        $contract = $this->createContract($client, $user, [
            'estado' => ContractStatus::CANCELADO,
            'dia_visita' => 10,
        ]);

        $service = app(VisitSchedulerService::class);
        $visit = $service->generateNextCycle($contract, $user->id);

        $this->assertNull($visit);
        $this->assertEquals(0, Visit::where('contrato_id', $contract->id)->count());
    }
}
