<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ArticleDelivery extends Model
{
    protected $table = 'article_deliveries';

    protected $fillable = [
        'articulo_id',
        'visita_id',
        'contrato_id',
        'cliente_id',
        'cantidad',
        'costo_unitario',
        'subtotal',
        'socio_id',
        'notas',
        'fecha_creacion',
    ];

    protected function casts(): array
    {
        return [
            'cantidad' => 'integer',
            'costo_unitario' => 'decimal:2',
            'subtotal' => 'decimal:2',
            'fecha_creacion' => 'datetime',
        ];
    }

    public function article(): BelongsTo
    {
        return $this->belongsTo(Article::class, 'articulo_id');
    }

    public function visit(): BelongsTo
    {
        return $this->belongsTo(Visit::class, 'visita_id');
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'contrato_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'cliente_id');
    }

    public function socio(): BelongsTo
    {
        return $this->belongsTo(User::class, 'socio_id');
    }
}
