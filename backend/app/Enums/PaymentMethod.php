<?php

namespace App\Enums;

enum PaymentMethod: string
{
    case EFECTIVO = 'EFECTIVO';
    case TRANSFERENCIA = 'TRANSFERENCIA';
    case DEPOSITO = 'DEPOSITO';
}
