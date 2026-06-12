<?php

namespace App\Models;

use App\Enums\PurchaseStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Purchase extends Model
{
    protected $table = 'purchases';

    protected $fillable = [
        'proveedor_id',
        'fecha',
        'fecha_vto_pago',
        'concepto',
        'monto_total',
        'monto_pagado',
        'saldo_pendiente',
        'metodo_pago',
        'estado',
        'comprobante',
        'socio_id',
        'fecha_creacion',
    ];

    protected function casts(): array
    {
        return [
            'fecha' => 'date',
            'fecha_vto_pago' => 'date',
            'monto_total' => 'decimal:2',
            'monto_pagado' => 'decimal:2',
            'saldo_pendiente' => 'decimal:2',
            'estado' => PurchaseStatus::class,
            'fecha_creacion' => 'datetime',
        ];
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class, 'proveedor_id');
    }

    public function details(): HasMany
    {
        return $this->hasMany(PurchaseDetail::class, 'compra_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(SupplierPayment::class, 'compra_id');
    }

    public function socio(): BelongsTo
    {
        return $this->belongsTo(User::class, 'socio_id');
    }

    public function scopePending($query)
    {
        return $query->where('estado', PurchaseStatus::PENDIENTE);
    }

    public function scopeReceived($query)
    {
        return $query->where('estado', PurchaseStatus::RECIBIDA);
    }

    public function scopeOverdue($query)
    {
        return $query->where('estado', '!=', PurchaseStatus::CANCELADA)
            ->where('saldo_pendiente', '>', 0)
            ->where('fecha_vto_pago', '<', now());
    }
}
