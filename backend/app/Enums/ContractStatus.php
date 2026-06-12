<?php

namespace App\Enums;

enum ContractStatus: string
{
    case ACTIVO = 'ACTIVO';
    case SUSPENDIDO = 'SUSPENDIDO';
    case FINALIZADO = 'FINALIZADO';
    case CANCELADO = 'CANCELADO';
}
