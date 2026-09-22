<?php

namespace App\Enums;

enum PrinterCondition: string
{
    case OPERATIVA = 'OPERATIVA';
    case REQUIERE_ATENCION = 'REQUIERE_ATENCION';
    case NO_OPERATIVA = 'NO_OPERATIVA';
    case PIEZAS = 'PIEZAS';
}
