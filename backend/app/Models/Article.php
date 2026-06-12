<?php

namespace App\Models;

use App\Enums\ArticleType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Article extends Model
{
    protected $table = 'articles';

    protected $fillable = [
        'tipo_articulo',
        'subtipo',
        'nombre',
        'marca',
        'modelo_sku',
        'stock_actual',
        'umbral_reposicion',
        'costo_unitario',
        'proveedor_id',
        'impresoras_compatibles',
        'activo',
        'fecha_creacion',
    ];

    protected function casts(): array
    {
        return [
            'tipo_articulo' => ArticleType::class,
            'stock_actual' => 'integer',
            'umbral_reposicion' => 'integer',
            'costo_unitario' => 'decimal:2',
            'impresoras_compatibles' => 'array',
            'activo' => 'boolean',
            'fecha_creacion' => 'datetime',
        ];
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class, 'proveedor_id');
    }

    public function movements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class, 'articulo_id');
    }

    public function articlesUsed(): HasMany
    {
        return $this->hasMany(ArticleUsed::class, 'articulo_id');
    }

    public function scopeLowStock($query)
    {
        return $query->whereColumn('stock_actual', '<=', 'umbral_reposicion');
    }

    public function scopeActive($query)
    {
        return $query->where('activo', true);
    }

    public function isLowStock(): bool
    {
        return $this->stock_actual <= $this->umbral_reposicion;
    }
}
