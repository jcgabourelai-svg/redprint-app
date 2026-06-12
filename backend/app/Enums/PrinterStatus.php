<?php

namespace App\Enums;

enum PrinterStatus: string
{
    case EN_ALMACEN = 'EN_ALMACEN';
    case RENTADA = 'RENTADA';
    case EN_MANTENIMIENTO = 'EN_MANTENIMIENTO';
    case DADA_DE_BAJA = 'DADA_DE_BAJA';
}
