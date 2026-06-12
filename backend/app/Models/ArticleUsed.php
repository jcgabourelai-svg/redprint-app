<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ArticleUsed extends Model
{
    protected $table = 'articles_used';

    public $timestamps = false;

    protected $fillable = [
        'articulo_id',
        'orden_mantto_id',
        'cantidad',
        'costo_unitario',
        'subtotal',
    ];

    protected function casts(): array
    {
        return [
            'cantidad' => 'integer',
            'costo_unitario' => 'decimal:2',
            'subtotal' => 'decimal:2',
        ];
    }

    public function article(): BelongsTo
    {
        return $this->belongsTo(Article::class, 'articulo_id');
    }

    public function maintenanceOrder(): BelongsTo
    {
        return $this->belongsTo(MaintenanceOrder::class, 'orden_mantto_id');
    }
}
