<?php

namespace App\Support;

use App\Models\Contract;
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
}
