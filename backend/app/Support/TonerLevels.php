<?php

namespace App\Support;

/**
 * Contrato del jsonb niveles_toner ({k,c,m,y}, int 0-100 o null) y su
 * normalización: única fuente de verdad compartida por los form requests
 * de lecturas/registros de campo y por TonerAlertService. Sin esta fuente
 * común, la regularización (que pasa el valor almacenado verbatim, sin
 * re-validar) divergiría de la captura directa.
 */
final class TonerLevels
{
    public const CLAVES = ['k', 'c', 'm', 'y'];

    /**
     * Descarta claves en null, castea valores numéricos (la regla integer
     * acepta "25" como string) y anula el campo completo si no queda ningún
     * valor (evita guardar {} ruidoso en BD).
     */
    public static function normalizar(?array $niveles): ?array
    {
        if ($niveles === null) {
            return null;
        }

        $conValor = [];
        foreach ($niveles as $clave => $valor) {
            if ($valor !== null) {
                $conValor[$clave] = is_numeric($valor) ? (int) $valor : $valor;
            }
        }

        return $conValor === [] ? null : $conValor;
    }
}
