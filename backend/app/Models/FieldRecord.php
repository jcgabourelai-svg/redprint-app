<?php

namespace App\Models;

use App\Enums\FieldRecordStatus;
use App\Enums\FieldRecordType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FieldRecord extends Model
{
    protected $table = 'field_records';

    protected $fillable = [
        'tipo',
        'estado',
        'nombre_cliente_reportado',
        'direccion_reportada',
        'marca_reportada',
        'modelo_reportada',
        'num_serie_reportado',
        'valor_contador',
        'articulos_entregados',
        'notas',
        'foto_evidencia',
        'ubicacion_lat',
        'ubicacion_lng',
        'capturado_en',
        'client_uuid',
        'socio_id',
        'creado_por',
        'cliente_id',
        'contrato_id',
        'impresora_id',
        'visita_id',
        'lectura_id',
        'vinculado_por',
        'vinculado_en',
        'motivo_descarte',
    ];

    protected function casts(): array
    {
        return [
            'tipo' => FieldRecordType::class,
            'estado' => FieldRecordStatus::class,
            'valor_contador' => 'integer',
            'articulos_entregados' => 'array',
            'ubicacion_lat' => 'decimal:7',
            'ubicacion_lng' => 'decimal:7',
            'capturado_en' => 'datetime',
            'vinculado_en' => 'datetime',
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

    public function printer(): BelongsTo
    {
        return $this->belongsTo(Printer::class, 'impresora_id');
    }

    public function visit(): BelongsTo
    {
        return $this->belongsTo(Visit::class, 'visita_id');
    }

    public function reading(): BelongsTo
    {
        return $this->belongsTo(Reading::class, 'lectura_id');
    }

    public function socio(): BelongsTo
    {
        return $this->belongsTo(User::class, 'socio_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creado_por');
    }

    public function vinculadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'vinculado_por');
    }
}
