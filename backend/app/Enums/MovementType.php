<?php

namespace App\Enums;

enum MovementType: string
{
    case ENTRADA = 'ENTRADA';
    case SALIDA = 'SALIDA';
    case AJUSTE = 'AJUSTE';
}
