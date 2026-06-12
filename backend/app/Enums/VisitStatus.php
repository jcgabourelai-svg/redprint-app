<?php

namespace App\Enums;

enum VisitStatus: string
{
    case PENDIENTE = 'PENDIENTE';
    case COMPLETADA = 'COMPLETADA';
    case REPROGRAMADA = 'REPROGRAMADA';
    case CANCELADA = 'CANCELADA';
}
