<?php

namespace App\Enums;

enum ArticleOrigin: string
{
    case ORIGINAL = 'ORIGINAL';
    case COMPATIBLE = 'COMPATIBLE';
    case REFACCIONADA = 'REFACCIONADA';
}
