<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Supplier extends Model
{
    protected $table = 'suppliers';

    protected $fillable = [
        'razon_social',
        'rfc',
        'contacto',
        'telefono',
        'correo',
        'notas',
        'activo',
    ];

    protected function casts(): array
    {
        return [
            'activo' => 'boolean',
        ];
    }

    public function articles(): HasMany
    {
        return $this->hasMany(Article::class, 'proveedor_id');
    }

    public function purchases(): HasMany
    {
        return $this->hasMany(Purchase::class, 'proveedor_id');
    }
}
