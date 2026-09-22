<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MaintenancePlan extends Model
{
    protected $table = 'maintenance_plans';

    protected $fillable = [
        'printer_model_id',
        'printer_id',
        'activo',
        'periodicidad_meses',
        'periodicidad_paginas',
        'ventana_aviso_dias',
        'ultimo_servicio_fecha',
        'ultimo_servicio_contador',
        'proximo_servicio_fecha',
        'proximo_servicio_contador',
    ];

    protected function casts(): array
    {
        return [
            'activo' => 'boolean',
            'periodicidad_meses' => 'integer',
            'periodicidad_paginas' => 'integer',
            'ventana_aviso_dias' => 'integer',
            'ultimo_servicio_fecha' => 'date',
            'ultimo_servicio_contador' => 'integer',
            'proximo_servicio_fecha' => 'date',
            'proximo_servicio_contador' => 'integer',
        ];
    }

    public function printerModel(): BelongsTo
    {
        return $this->belongsTo(PrinterModel::class, 'printer_model_id');
    }

    public function printer(): BelongsTo
    {
        return $this->belongsTo(Printer::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(MaintenanceOrder::class, 'maintenance_plan_id');
    }

    public function scopeActivos($query)
    {
        return $query->where('activo', true);
    }

    /** True si define cadencia por meses o por páginas (al menos una). */
    public function tieneCadencia(): bool
    {
        return ($this->periodicidad_meses !== null && $this->periodicidad_meses > 0)
            || ($this->periodicidad_paginas !== null && $this->periodicidad_paginas > 0);
    }
}
