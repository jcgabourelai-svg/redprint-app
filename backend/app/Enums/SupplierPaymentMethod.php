<?php

namespace App\Enums;

enum SupplierPaymentMethod: string
{
    case TRANSFERENCIA = 'TRANSFERENCIA';
    case EFECTIVO = 'EFECTIVO';
    case CHEQUE = 'CHEQUE';
}
