<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;

/**
 * Búsqueda case-insensitive (Postgres `ilike`) sobre múltiples columnas.
 *
 * Uso típico desde un controller:
 *   $query->search($request->search, ['nombre', 'marca']);
 *
 * El binding del valor evita inyección SQL; se escapan además los comodines
 * literales `%` y `_` del término ingresado por el usuario.
 */
trait Searchable
{
    public function scopeSearch(Builder $query, ?string $term, array $columns): Builder
    {
        $term = is_string($term) ? trim($term) : '';

        if ($term === '' || empty($columns)) {
            return $query;
        }

        // Escapar comodines literales para que no alteren la semántica de la búsqueda.
        $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $term);
        $pattern = "%{$escaped}%";

        return $query->where(function (Builder $sub) use ($columns, $pattern) {
            foreach ($columns as $column) {
                $sub->orWhere($column, 'ilike', $pattern);
            }
        });
    }
}
