<?php

namespace App\Models;

use App\Enums\VisitStatus;
use App\Enums\VisitType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Visit extends Model
{
    protected $table = 'visits';

    protected $fillable = [
        'cliente_id',
        'contrato_id',
        'tipo_visita',
        'fecha_programada',
        'fecha_realizada',
        'socio_id',
        'estado',
        'notas',
        'creado_por',
        'fecha_creacion',
    ];

    protected function casts(): array
    {
        return [
            'tipo_visita' => VisitType::class,
            'fecha_programada' => 'date',
            'fecha_realizada' => 'datetime',
            'estado' => VisitStatus::class,
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

    public function socio(): BelongsTo
    {
        return $this->belongsTo(User::class, 'socio_id');
    }

    public function readings(): HasMany
    {
        return $this->hasMany(Reading::class, 'visita_id');
    }

    public function maintenanceOrders(): HasMany
    {
        return $this->hasMany(MaintenanceOrder::class, 'visita_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creado_por');
    }

    public function scopePending($query)
    {
        return $query->where('estado', VisitStatus::PENDIENTE);
    }

    public function scopeByMonth($query, string $month)
    {
        return $query->where('fecha_programada', 'like', $month . '%');
    }
}
