<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Reading extends Model
{
    protected $table = 'readings';

    protected $fillable = [
        'visita_id',
        'impresora_id',
        'contrato_id',
        'fecha',
        'valor_contador',
        'paginas_periodo',
        'socio_id',
        'foto_evidencia',
        'justificacion_anomalia',
        'es_anomalia',
        'ubicacion_lat',
        'ubicacion_lng',
        'creado_por',
        'fecha_creacion',
    ];

    protected function casts(): array
    {
        return [
            'fecha' => 'date',
            'valor_contador' => 'integer',
            'paginas_periodo' => 'integer',
            'es_anomalia' => 'boolean',
            'ubicacion_lat' => 'decimal:7',
            'ubicacion_lng' => 'decimal:7',
            'fecha_creacion' => 'datetime',
        ];
    }

    public function visit(): BelongsTo
    {
        return $this->belongsTo(Visit::class, 'visita_id');
    }

    public function printer(): BelongsTo
    {
        return $this->belongsTo(Printer::class, 'impresora_id');
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'contrato_id');
    }

    public function socio(): BelongsTo
    {
        return $this->belongsTo(User::class, 'socio_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creado_por');
    }
}
