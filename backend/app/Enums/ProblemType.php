<?php

namespace App\Enums;

enum ProblemType: string
{
    case NO_IMPRIME = 'NO_IMPRIME';
    case CALIDAD_DEFICIENTE = 'CALIDAD_DEFICIENTE';
    case ATASCOS = 'ATASCOS';
    case ERROR_PANTALLA = 'ERROR_PANTALLA';
    case OTRO = 'OTRO';
}
