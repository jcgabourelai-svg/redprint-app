<?php

namespace App\Enums;

enum PurchaseStatus: string
{
    case PENDIENTE = 'PENDIENTE';
    case RECIBIDA = 'RECIBIDA';
    case CANCELADA = 'CANCELADA';
}
