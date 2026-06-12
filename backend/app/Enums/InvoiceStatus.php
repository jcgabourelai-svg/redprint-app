<?php

namespace App\Enums;

enum InvoiceStatus: string
{
    case PENDIENTE = 'PENDIENTE';
    case PARCIALMENTE_PAGADA = 'PARCIALMENTE_PAGADA';
    case PAGADA = 'PAGADA';
    case VENCIDA = 'VENCIDA';
    case INCOBRABLE = 'INCOBRABLE';
}
