<?php

namespace App\Models;

use App\Enums\PrinterStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Printer extends Model
{
    protected $table = 'printers';

    protected $fillable = [
        'marca',
        'modelo',
        'num_serie',
        'fecha_adquisicion',
        'costo_adquisicion',
        'codigo_negocio',
        'vida_util_meses',
        'garantia_hasta',
        'estado',
        'almacen_id',
        'contador_actual',
        'creado_por',
        'fecha_creacion',
    ];

    protected $appends = ['garantia_status', 'vida_util_restante'];

    protected function casts(): array
    {
        return [
            'fecha_adquisicion' => 'date',
            'costo_adquisicion' => 'decimal:2',
            'garantia_hasta' => 'date',
            'estado' => PrinterStatus::class,
            'contador_actual' => 'integer',
            'fecha_creacion' => 'datetime',
        ];
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'almacen_id');
    }

    public function history(): HasMany
    {
        return $this->hasMany(PrinterHistory::class, 'impresora_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creado_por');
    }

    public function scopeEnAlmacen($query)
    {
        return $query->where('estado', PrinterStatus::EN_ALMACEN);
    }

    public function scopeRentada($query)
    {
        return $query->where('estado', PrinterStatus::RENTADA);
    }

    public function maintenanceOrders()
    {
        return $this->hasMany(MaintenanceOrder::class, 'impresora_id');
    }

    public function readings()
    {
        return $this->hasMany(Reading::class, 'impresora_id');
    }

    public function expenses()
    {
        return $this->hasMany(PrinterExpense::class, 'impresora_id');
    }

    public function scopeActive($query)
    {
        return $query->where('estado', '!=', PrinterStatus::DADA_DE_BAJA);
    }

    public function calculateRemainingLife(): int
    {
        if (!$this->fecha_adquisicion || !$this->vida_util_meses) {
            return 0;
        }

        $endOfLife = $this->fecha_adquisicion->copy()->addMonths($this->vida_util_meses);
        return $endOfLife->diffInMonths(now(), false);
    }

    public function getGarantiaStatusAttribute(): string
    {
        if (!$this->garantia_hasta) {
            return 'sin_garantia';
        }

        return $this->garantia_hasta->gte(now()) ? 'vigente' : 'vencida';
    }

    public function getVidaUtilRestanteAttribute(): int
    {
        return $this->calculateRemainingLife();
    }
}
