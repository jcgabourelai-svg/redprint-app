<?php

namespace Tests\Feature;

use App\Models\Contract;
use App\Support\CicloFacturacion;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Ciclos de facturacion por aniversario del contrato (D17): bounds con
 * clamp de fin de mes, recortes de vigencia y pertenencia de fechas.
 */
class CicloFacturacionTest extends TestCase
{
    private function contrato(string $fechaInicio, ?string $fechaFin = null): Contract
    {
        return new Contract([
            'fecha_inicio' => $fechaInicio,
            'fecha_fin' => $fechaFin,
        ]);
    }

    public function test_ciclo_normal_veinte_a_veinte(): void
    {
        $contrato = $this->contrato('2026-08-20');

        $ciclo0 = CicloFacturacion::bounds($contrato, 0);
        $this->assertEquals('2026-08-20', $ciclo0['inicio']->toDateString());
        $this->assertEquals('2026-09-19', $ciclo0['fin']->toDateString());

        $ciclo1 = CicloFacturacion::bounds($contrato, 1);
        $this->assertEquals('2026-09-20', $ciclo1['inicio']->toDateString());
        $this->assertEquals('2026-10-19', $ciclo1['fin']->toDateString());
    }

    public function test_clamp_fin_de_mes_dia_31_sin_deriva(): void
    {
        // 2026 no es bisiesto: feb tiene 28 dias.
        $contrato = $this->contrato('2026-01-31');

        $ciclo0 = CicloFacturacion::bounds($contrato, 0);
        $this->assertEquals('2026-01-31', $ciclo0['inicio']->toDateString());
        $this->assertEquals('2026-02-27', $ciclo0['fin']->toDateString());

        $ciclo1 = CicloFacturacion::bounds($contrato, 1);
        $this->assertEquals('2026-02-28', $ciclo1['inicio']->toDateString());
        $this->assertEquals('2026-03-30', $ciclo1['fin']->toDateString());

        $ciclo2 = CicloFacturacion::bounds($contrato, 2);
        $this->assertEquals('2026-03-31', $ciclo2['inicio']->toDateString());
        $this->assertEquals('2026-04-29', $ciclo2['fin']->toDateString());
    }

    public function test_clamp_bisiesto_recupera_el_29(): void
    {
        $contrato = $this->contrato('2028-01-31');

        $ciclo1 = CicloFacturacion::bounds($contrato, 1);
        $this->assertEquals('2028-02-29', $ciclo1['inicio']->toDateString());

        $ciclo2 = CicloFacturacion::bounds($contrato, 2);
        $this->assertEquals('2028-03-31', $ciclo2['inicio']->toDateString());
    }

    public function test_bounds_recortados_a_la_vigencia(): void
    {
        // Recorte por fecha_fin a medias de ciclo.
        $contrato = $this->contrato('2026-06-01', '2026-08-10');

        $ultimo = CicloFacturacion::bounds($contrato, 2);
        $this->assertEquals('2026-08-01', $ultimo['inicio']->toDateString());
        $this->assertEquals('2026-08-10', $ultimo['fin']->toDateString());

        // Ciclo posterior a la vigencia: inicio > fin (fuera de vigencia).
        $fuera = CicloFacturacion::bounds($contrato, 3);
        $this->assertTrue($fuera['inicio']->gt($fuera['fin']));

        // Ciclo 0 inicia exactamente en fecha_inicio (recorte de inicio).
        $primero = CicloFacturacion::bounds($contrato, 0);
        $this->assertEquals('2026-06-01', $primero['inicio']->toDateString());
    }

    public function test_ciclo_que_contiene_en_bordes(): void
    {
        $contrato = $this->contrato('2026-08-20');

        // El dia de inicio de ciclo pertenece al ciclo que abre.
        $this->assertEquals(0, CicloFacturacion::cicloQueContiene($contrato, Carbon::parse('2026-08-20')));
        $this->assertEquals(0, CicloFacturacion::cicloQueContiene($contrato, Carbon::parse('2026-09-19')));
        $this->assertEquals(1, CicloFacturacion::cicloQueContiene($contrato, Carbon::parse('2026-09-20')));

        // Antes del contrato: -1.
        $this->assertEquals(-1, CicloFacturacion::cicloQueContiene($contrato, Carbon::parse('2026-08-19')));
    }

    public function test_ciclo_que_contiene_consistente_con_clamp(): void
    {
        $contrato = $this->contrato('2026-01-31');

        // 28-feb es inicio de ciclo 1 (31-ene + 1 mes clamped): abre ciclo 1.
        $this->assertEquals(1, CicloFacturacion::cicloQueContiene($contrato, Carbon::parse('2026-02-28')));
        // 27-feb sigue siendo el cierre del ciclo 0.
        $this->assertEquals(0, CicloFacturacion::cicloQueContiene($contrato, Carbon::parse('2026-02-27')));
    }

    public function test_es_inicio_de_ciclo(): void
    {
        $contrato = $this->contrato('2026-08-20');

        $this->assertTrue(CicloFacturacion::esInicioDeCiclo($contrato, Carbon::parse('2026-08-20')));
        $this->assertTrue(CicloFacturacion::esInicioDeCiclo($contrato, Carbon::parse('2026-09-20')));
        $this->assertFalse(CicloFacturacion::esInicioDeCiclo($contrato, Carbon::parse('2026-09-19')));
        $this->assertFalse(CicloFacturacion::esInicioDeCiclo($contrato, Carbon::parse('2026-09-01')));

        // Fechas clamped del mismo contrato (inicio 31-ene).
        $conClamp = $this->contrato('2026-01-31');
        $this->assertTrue(CicloFacturacion::esInicioDeCiclo($conClamp, Carbon::parse('2026-02-28')));
        $this->assertTrue(CicloFacturacion::esInicioDeCiclo($conClamp, Carbon::parse('2026-03-31')));
        $this->assertFalse(CicloFacturacion::esInicioDeCiclo($conClamp, Carbon::parse('2026-03-30')));
    }
}
