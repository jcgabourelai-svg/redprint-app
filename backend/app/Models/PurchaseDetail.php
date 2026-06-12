<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseDetail extends Model
{
    protected $table = 'purchase_details';

    public $timestamps = false;

    protected $fillable = [
        'compra_id',
        'articulo_id',
        'articulo_nombre',
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

    public function purchase(): BelongsTo
    {
        return $this->belongsTo(Purchase::class, 'compra_id');
    }

    public function article(): BelongsTo
    {
        return $this->belongsTo(Article::class, 'articulo_id');
    }
}
