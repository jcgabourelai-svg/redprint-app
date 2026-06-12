<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BankAccount extends Model
{
    protected $table = 'bank_accounts';

    protected $fillable = [
        'banco',
        'tipo_cuenta',
        'numero_cuenta',
        'moneda',
        'saldo',
        'saldo_inicial',
        'descripcion',
        'activo',
        'socio_id',
    ];

    protected function casts(): array
    {
        return [
            'saldo' => 'decimal:2',
            'saldo_inicial' => 'decimal:2',
            'activo' => 'boolean',
        ];
    }

    public function socio(): BelongsTo
    {
        return $this->belongsTo(User::class, 'socio_id');
    }

    public function movements(): HasMany
    {
        return $this->hasMany(BankMovement::class, 'cuenta_bancaria_id');
    }
}
