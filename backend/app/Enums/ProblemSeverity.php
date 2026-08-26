<?php

namespace App\Enums;

enum ProblemSeverity: string
{
    case BAJA = 'BAJA';
    case MEDIA = 'MEDIA';
    case ALTA = 'ALTA';
    case CRITICA = 'CRITICA';
}
