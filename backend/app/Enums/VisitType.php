<?php

namespace App\Enums;

enum VisitType: string
{
    case LECTURA = 'LECTURA';
    case MANTENIMIENTO = 'MANTENIMIENTO';
    case INSTALACION = 'INSTALACION';
    case RETIRO = 'RETIRO';
    case ENTREGA_INSUMOS = 'ENTREGA_INSUMOS';
}
