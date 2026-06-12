<?php

namespace App\Models;

use App\Enums\ContractStatus;
use App\Enums\VisitFrequency;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Client extends Model
{
    protected $table = 'clients';

    protected $fillable = [
        'razon_social',
        'rfc',
        'nombre_contacto',
        'telefono',
        'correo',
        'direccion_instalacion',
        'notas',
        'creado_por',
        'fecha_creacion',
    ];

    protected $appends = ['saldo_pendiente', 'estado', 'contratos_activos_count'];

    protected function casts(): array
    {
        return [
            'fecha_creacion' => 'datetime',
        ];
    }

    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class, 'cliente_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creado_por');
    }

    public function activeContract(): ?Contract
    {
        return $this->contracts()->where('estado', ContractStatus::ACTIVO)->first();
    }

    public function getContratosActivosCountAttribute(): int
    {
        return $this->contracts()->where('estado', ContractStatus::ACTIVO)->count();
    }

    public function getSaldoPendienteAttribute(): float
    {
        return $this->contracts()->with('invoices')->get()->sum(function ($contract) {
            return $contract->invoices->sum('saldo_pendiente');
        });
    }

    public function getEstadoAttribute(): string
    {
        return $this->saldo_pendiente == 0 ? 'al_corriente' : 'con_saldo';
    }
}
