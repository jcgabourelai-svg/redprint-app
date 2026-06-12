<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

class ContractPrinter extends Pivot
{
    protected $table = 'contract_printer';

    protected $fillable = [
        'contrato_id',
        'impresora_id',
        'fecha_asignacion',
        'fecha_liberacion',
        'activa',
        'lectura_inicial',
    ];

    protected function casts(): array
    {
        return [
            'fecha_asignacion' => 'date',
            'fecha_liberacion' => 'date',
            'activa' => 'boolean',
            'lectura_inicial' => 'integer',
        ];
    }
}
