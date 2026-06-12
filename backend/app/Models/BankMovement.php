<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BankMovement extends Model
{
    protected $table = 'bank_movements';

    protected $fillable = [
        'cuenta_bancaria_id',
        'tipo',
        'monto',
        'referencia',
        'descripcion',
        'conciliacion_status',
        'transaccion_vinculada_id',
        'categoria',
        'fecha',
        'socio_id',
    ];

    protected function casts(): array
    {
        return [
            'monto' => 'decimal:2',
            'fecha' => 'date',
        ];
    }

    public function cuenta(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class, 'cuenta_bancaria_id');
    }

    public function socio(): BelongsTo
    {
        return $this->belongsTo(User::class, 'socio_id');
    }
}
