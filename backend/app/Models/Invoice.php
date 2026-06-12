<?php

namespace App\Models;

use App\Enums\InvoiceStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Invoice extends Model
{
    protected $table = 'invoices';

    protected $fillable = [
        'numero_factura',
        'cliente_id',
        'contrato_id',
        'fecha_emision',
        'fecha_vencimiento',
        'periodo_inicio',
        'periodo_fin',
        'monto_total',
        'monto_pagado',
        'saldo_pendiente',
        'estado',
        'notas',
        'socio_id',
        'comprobante',
        'creado_por',
        'fecha_creacion',
    ];

    protected function casts(): array
    {
        return [
            'fecha_emision' => 'date',
            'fecha_vencimiento' => 'date',
            'periodo_inicio' => 'date',
            'periodo_fin' => 'date',
            'monto_total' => 'decimal:2',
            'monto_pagado' => 'decimal:2',
            'saldo_pendiente' => 'decimal:2',
            'estado' => InvoiceStatus::class,
            'fecha_creacion' => 'datetime',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'cliente_id');
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'contrato_id');
    }

    public function details(): HasMany
    {
        return $this->hasMany(InvoiceDetail::class, 'factura_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class, 'factura_id');
    }

    public function socio(): BelongsTo
    {
        return $this->belongsTo(User::class, 'socio_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creado_por');
    }

    public function scopePending($query)
    {
        return $query->where('estado', InvoiceStatus::PENDIENTE);
    }

    public function scopeOverdue($query)
    {
        return $query->where('estado', '!=', InvoiceStatus::PAGADA)
            ->where('fecha_vencimiento', '<', now());
    }
}
