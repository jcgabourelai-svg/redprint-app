<?php

namespace App\Enums;

enum MaintenanceStatus: string
{
    case PROGRAMADA = 'PROGRAMADA';
    case COMPLETADA = 'COMPLETADA';
    case CANCELADA = 'CANCELADA';
}
