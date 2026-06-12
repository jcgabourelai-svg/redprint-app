<?php

namespace App\Models;

use App\Enums\SupplierPaymentMethod;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupplierPayment extends Model
{
    protected $table = 'supplier_payments';

    protected $fillable = [
        'compra_id',
        'fecha',
        'monto',
        'metodo',
        'socio_id',
        'cuenta_bancaria_id',
        'movimiento_bancario_id',
        'comprobante',
        'fecha_creacion',
    ];

    protected function casts(): array
    {
        return [
            'fecha' => 'date',
            'monto' => 'decimal:2',
            'metodo' => SupplierPaymentMethod::class,
            'fecha_creacion' => 'datetime',
        ];
    }

    public function purchase(): BelongsTo
    {
        return $this->belongsTo(Purchase::class, 'compra_id');
    }

    public function socio(): BelongsTo
    {
        return $this->belongsTo(User::class, 'socio_id');
    }
}
