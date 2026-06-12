<?php

namespace App\Enums;

enum VisitFrequency: string
{
    case MENSUAL = 'MENSUAL';
    case QUINCENAL = 'QUINCENAL';
    case SEMANAL = 'SEMANAL';
    case CUSTOM = 'CUSTOM';
}
