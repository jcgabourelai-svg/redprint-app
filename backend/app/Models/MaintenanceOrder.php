<?php

namespace App\Models;

use App\Enums\MaintenanceStatus;
use App\Enums\MaintenanceType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class MaintenanceOrder extends Model
{
    use SoftDeletes;

    protected $table = 'maintenance_orders';

    protected $fillable = [
        'impresora_id',
        'fecha',
        'tipo_mantto',
        'desc_problema',
        'trabajo_realizado',
        'costo_mano_obra',
        'costo_total',
        'socio_id',
        'visita_id',
        'estado',
        'estado_anterior_impresora',
        'fecha_creacion',
    ];

    protected function casts(): array
    {
        return [
            'fecha' => 'date',
            'tipo_mantto' => MaintenanceType::class,
            'costo_mano_obra' => 'decimal:2',
            'costo_total' => 'decimal:2',
            'estado' => MaintenanceStatus::class,
            'fecha_creacion' => 'datetime',
        ];
    }

    public function printer(): BelongsTo
    {
        return $this->belongsTo(Printer::class, 'impresora_id');
    }

    public function visit(): BelongsTo
    {
        return $this->belongsTo(Visit::class, 'visita_id');
    }

    public function socio(): BelongsTo
    {
        return $this->belongsTo(User::class, 'socio_id');
    }

    public function articlesUsed(): HasMany
    {
        return $this->hasMany(ArticleUsed::class, 'orden_mantto_id');
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(PrinterExpense::class, 'orden_mantto_id');
    }

    public function scopeProgramada($query)
    {
        return $query->where('estado', MaintenanceStatus::PROGRAMADA);
    }

    public function scopeCompletada($query)
    {
        return $query->where('estado', MaintenanceStatus::COMPLETADA);
    }
}
