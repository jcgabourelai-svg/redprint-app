<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PeriodClose extends Model
{
    protected $table = 'period_closes';

    protected $fillable = [
        'periodo',
        'estado',
        'fecha_cierre',
        'cerrado_por',
        'ingresos',
        'egresos',
        'rentabilidad',
        'facturas_emitidas',
        'facturas_pagadas',
        'facturas_pendientes',
        'gastos_registrados',
        'movimientos_bancarios',
        'movimientos_conciliados',
        'movimientos_pendientes',
    ];

    protected function casts(): array
    {
        return [
            'fecha_cierre' => 'date',
            'ingresos' => 'decimal:2',
            'egresos' => 'decimal:2',
            'rentabilidad' => 'decimal:2',
            'facturas_emitidas' => 'integer',
            'facturas_pagadas' => 'integer',
            'facturas_pendientes' => 'integer',
            'gastos_registrados' => 'decimal:2',
            'movimientos_bancarios' => 'integer',
            'movimientos_conciliados' => 'integer',
            'movimientos_pendientes' => 'integer',
        ];
    }

    public function cerradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cerrado_por');
    }

    public function validations(): HasMany
    {
        return $this->hasMany(PeriodValidation::class, 'period_close_id');
    }
}
