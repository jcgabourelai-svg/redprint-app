<?php

namespace App\Models;

use App\Enums\MovementType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryMovement extends Model
{
    protected $table = 'inventory_movements';

    protected $fillable = [
        'articulo_id',
        'tipo_movimiento',
        'cantidad',
        'stock_anterior',
        'stock_posterior',
        'referencia_tipo',
        'referencia_id',
        'justificacion',
        'fecha',
        'socio_id',
        'fecha_creacion',
    ];

    protected function casts(): array
    {
        return [
            'tipo_movimiento' => MovementType::class,
            'cantidad' => 'integer',
            'stock_anterior' => 'integer',
            'stock_posterior' => 'integer',
            'fecha' => 'date',
            'fecha_creacion' => 'datetime',
        ];
    }

    public function article(): BelongsTo
    {
        return $this->belongsTo(Article::class, 'articulo_id');
    }

    public function socio(): BelongsTo
    {
        return $this->belongsTo(User::class, 'socio_id');
    }
}
