<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PrinterBrand extends Model
{
    protected $table = 'printer_brands';

    protected $fillable = ['nombre', 'slug'];

    /**
     * Normaliza un nombre de marca a su clave de agrupación (slug).
     * Único punto de normalización: lo usan el modelo, el controller, el seeder
     * y la migración para que el dedup por marca sea consistente.
     */
    public static function slugFrom(string $nombre): string
    {
        return strtolower(trim($nombre));
    }

    protected static function booted(): void
    {
        static::saving(function (self $brand) {
            if (empty($brand->slug)) {
                $brand->slug = self::slugFrom($brand->nombre);
            }
        });
    }

    public function modelos(): HasMany
    {
        return $this->hasMany(PrinterModel::class, 'brand_id');
    }
}
