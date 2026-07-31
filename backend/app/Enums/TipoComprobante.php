<?php

namespace App\Enums;

/**
 * TipoDeComprobante del CFDI (SAT).
 * I = Ingreso, E = Egreso, T = Traslado, N = Nomina, P = Pago.
 */
enum TipoComprobante: string
{
    case INGRESO = 'I';
    case EGRESO = 'E';
    case TRASLADO = 'T';
    case NOMINA = 'N';
    case PAGO = 'P';
}
