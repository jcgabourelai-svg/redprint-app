<?php

namespace App\Support;

use App\Models\Contract;
use App\Services\VisitService;
use Illuminate\Support\Carbon;

/**
 * Ciclos de facturacion por aniversario del contrato (D17): el ciclo N
 * inicia en fecha_inicio + N meses (con clamp de fin de mes) y termina un
 * dia antes del inicio del ciclo N+1, recortado a la vigencia. Clase pura
 * y sin estado; los inicios SIEMPRE se derivan de fecha_inicio (nunca
 * encadenando desde el fin del ciclo anterior) para que los dias 29/30/31
 * "recuperen" su dia en los meses que lo tienen.
 */
final class CicloFacturacion
{
    /** Tope interno del ciclo que contiene una fecha (100 anos de margen). */
    private const MAX_CICLOS = 1200;

    public static function inicioDeCiclo(Contract $contrato, int $n): Carbon
    {
        return $contrato->fecha_inicio->copy()->addMonthsNoOverflow($n)->startOfDay();
    }

    /**
     * Bounds del ciclo N recortados a la vigencia del contrato (regla 3:
     * primer/ultimo ciclo parcial). Si inicio > fin, el ciclo esta fuera
     * de vigencia y quien llama decide que hacer.
     *
     * @return array{inicio: Carbon, fin: Carbon}
     */
    public static function bounds(Contract $contrato, int $n): array
    {
        $inicio = self::inicioDeCiclo($contrato, $n);
        $inicioContrato = $contrato->fecha_inicio->copy()->startOfDay();
        if ($inicioContrato->gt($inicio)) {
            $inicio = $inicioContrato;
        }

        $fin = self::inicioDeCiclo($contrato, $n + 1)->subDay()->endOfDay();
        if ($contrato->fecha_fin !== null) {
            $finContrato = $contrato->fecha_fin->copy()->endOfDay();
            if ($finContrato->lt($fin)) {
                $fin = $finContrato;
            }
        }

        return ['inicio' => $inicio, 'fin' => $fin];
    }

    /**
     * Indice del ciclo que contiene $fecha (iterando inicioDeCiclo: a
     * prueba de bordes de clamp). -1 si $fecha es anterior al inicio del
     * contrato.
     */
    public static function cicloQueContiene(Contract $contrato, Carbon $fecha): int
    {
        $dia = $fecha->copy()->startOfDay();
        for ($n = 0; $n < self::MAX_CICLOS; $n++) {
            if (self::inicioDeCiclo($contrato, $n)->gt($dia)) {
                return $n - 1;
            }
        }

        return self::MAX_CICLOS - 1;
    }

    /**
     * Indice del ciclo en curso (el que contiene hoy).
     */
    public static function cicloActual(Contract $contrato): int
    {
        return self::cicloQueContiene($contrato, Carbon::now());
    }

    /**
     * True si $fecha coincide exactamente con el inicio (clamped) de un
     * ciclo del contrato. No valida vigencia hacia fecha_fin: eso lo hace
     * quien consume los bounds.
     */
    public static function esInicioDeCiclo(Contract $contrato, Carbon $fecha): bool
    {
        $dia = $fecha->copy()->startOfDay();
        if ($dia->lt($contrato->fecha_inicio->copy()->startOfDay())) {
            return false;
        }

        $n = self::cicloQueContiene($contrato, $dia);

        return self::inicioDeCiclo($contrato, $n)->equalTo($dia);
    }

    /**
     * Ventana de cierre del ciclo (D22): [fin − MAX_DIAS_ADELANTO, fin +
     * dias_gracia], a dia. La lectura no facturada mas tardia del contrato
     * dentro de esta ventana es la "lectura de corte" del ciclo. El mismo
     * VisitService::MAX_DIAS_ADELANTO (D21) define cuantos dias antes del
     * corte puede capturarse una visita: una lectura capturada a maximo
     * adelanto todavia cierra su ciclo; dias_gracia >= 1 defensivo (la
     * migracion de D22 deja el default en 7).
     *
     * @param  Carbon  $finCiclo  Fin del ciclo (recortado a la vigencia).
     * @return array{desde: Carbon, hasta: Carbon}
     */
    public static function ventanaCierre(Contract $contrato, Carbon $finCiclo): array
    {
        $fin = $finCiclo->copy()->startOfDay();
        $gracia = max(1, (int) ($contrato->dias_gracia ?? 0));

        return [
            'desde' => $fin->copy()->subDays(VisitService::MAX_DIAS_ADELANTO)->startOfDay(),
            'hasta' => $fin->copy()->addDays($gracia)->startOfDay(),
        ];
    }

    /**
     * True si [inicio, fin] coincide exactamente (a dia) con los bounds del
     * ciclo que contiene $fin y $inicio es inicio de ciclo. Solo esos rangos
     * activan el arrastre de consumo (D22): batch de ciclos, recalculo de
     * esos borradores y estimacion de pendientes. El rango libre del wizard
     * mantiene whereBetween + 1x paquete.
     */
    public static function esRangoAlineadaACiclo(Contract $contrato, Carbon $inicio, Carbon $fin): bool
    {
        $inicioDia = $inicio->copy()->startOfDay();
        $finDia = $fin->copy()->startOfDay();

        if (!self::esInicioDeCiclo($contrato, $inicioDia)) {
            return false;
        }

        $n = self::cicloQueContiene($contrato, $finDia);
        if ($n < 0) {
            return false;
        }

        $bounds = self::bounds($contrato, $n);

        return $bounds['inicio']->copy()->startOfDay()->equalTo($inicioDia)
            && $bounds['fin']->copy()->startOfDay()->equalTo($finDia);
    }
}
