<?php

namespace App\Enums;

enum FieldRecordStatus: string
{
    case PENDIENTE = 'PENDIENTE';
    case VINCULADO = 'VINCULADO';
    case DESCARTADO = 'DESCARTADO';
}
