<?php

namespace App\Enums;

enum FieldRecordType: string
{
    case LECTURA = 'LECTURA';
    case ENTREGA_INSUMOS = 'ENTREGA_INSUMOS';
    case OTRO = 'OTRO';
}
