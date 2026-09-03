<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
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
        'lectura_final',
        'fecha_lectura_final',
        'motivo_liberacion',
        'justificacion_sin_lectura',
        'reemplaza_a',
        'alias',
        'color',
    ];

    protected function casts(): array
    {
        return [
            'fecha_asignacion' => 'date',
            'fecha_liberacion' => 'date',
            'fecha_lectura_final' => 'date',
            'activa' => 'boolean',
            'lectura_inicial' => 'integer',
            'lectura_final' => 'integer',
        ];
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'contrato_id');
    }

    public function printer(): BelongsTo
    {
        return $this->belongsTo(Printer::class, 'impresora_id');
    }

    /** Ventana de asignación a la que esta fila reemplaza (sustitución). */
    public function reemplazaA(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reemplaza_a');
    }

    /** Ventana que reemplazó a esta fila (null si sigue activa o no fue sustituida). */
    public function reemplazadaPor(): HasOne
    {
        return $this->hasOne(self::class, 'reemplaza_a');
    }
}
