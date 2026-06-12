<?php

namespace App\Models;

use App\Enums\ContractStatus;
use App\Enums\VisitFrequency;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Contract extends Model
{
    protected $table = 'contracts';

    protected $fillable = [
        'cliente_id',
        'codigo_negocio',
        'fecha_inicio',
        'fecha_fin',
        'tarifa_base',
        'paginas_incluidas',
        'costo_pag_excedente',
        'dias_gracia',
        'frecuencia_visitas',
        'dias_adelanto',
        'estado',
        'creado_por',
        'fecha_creacion',
    ];

    protected $appends = ['rentabilidad', 'ingresos', 'costos', 'margen'];

    protected function casts(): array
    {
        return [
            'fecha_inicio' => 'date',
            'fecha_fin' => 'date',
            'tarifa_base' => 'decimal:2',
            'paginas_incluidas' => 'integer',
            'costo_pag_excedente' => 'decimal:4',
            'dias_gracia' => 'integer',
            'frecuencia_visitas' => VisitFrequency::class,
            'dias_adelanto' => 'integer',
            'estado' => ContractStatus::class,
            'fecha_creacion' => 'datetime',
        ];
    }

    protected $withCount = [
        'printers',
    ];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'cliente_id');
    }

    public function printers(): BelongsToMany
    {
        return $this->belongsToMany(Printer::class, 'contract_printer', 'contrato_id', 'impresora_id')
            ->withPivot(['fecha_asignacion', 'fecha_liberacion', 'activa', 'lectura_inicial'])
            ->withTimestamps();
    }

    public function activePrinters(): BelongsToMany
    {
        return $this->printers()->wherePivot('activa', true);
    }

    public function visits(): HasMany
    {
        return $this->hasMany(Visit::class, 'contrato_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creado_por');
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'contrato_id');
    }

    public function calculateEstimatedAmount(int $pagesConsumed): float
    {
        $excess = max(0, $pagesConsumed - $this->paginas_incluidas);
        return (float) ($this->tarifa_base + ($excess * $this->costo_pag_excedente));
    }

    public function getIngresosAttribute(): float
    {
        return $this->invoices()->sum('monto_pagado');
    }

    public function getCostosAttribute(): float
    {
        $maintenanceCost = $this->printers->sum(function ($printer) {
            return $printer->maintenanceOrders()->sum('costo_total');
        });

        $expenseCost = $this->printers->sum(function ($printer) {
            return $printer->expenses()->sum('monto');
        });

        return (float) ($maintenanceCost + $expenseCost);
    }

    public function getRentabilidadAttribute(): float
    {
        return $this->ingresos - $this->costos;
    }

    public function getMargenAttribute(): float
    {
        return round(($this->rentabilidad / max($this->ingresos, 1)) * 100, 2);
    }
}
