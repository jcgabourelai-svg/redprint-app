<?php

namespace App\Models;

use App\Enums\ArticleType;
use App\Traits\Searchable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Article extends Model
{
    use Searchable;

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
        'activo',
        'motivo_baja',
        'fecha_baja',
        'fecha_creacion',
    ];

    protected function casts(): array
    {
        return [
            'tipo_articulo' => ArticleType::class,
            'stock_actual' => 'integer',
            'umbral_reposicion' => 'integer',
            'costo_unitario' => 'decimal:2',
            'activo' => 'boolean',
            'fecha_baja' => 'datetime',
            'fecha_creacion' => 'datetime',
        ];
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class, 'proveedor_id');
    }

    public function modelosCompatibles(): BelongsToMany
    {
        return $this->belongsToMany(PrinterModel::class, 'article_printer_model', 'article_id', 'printer_model_id');
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
