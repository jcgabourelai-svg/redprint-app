<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Aplica ordenamiento controlado por el cliente sobre todo el dataset.
 *
 * Se valida estrictamente la columna solicitada contra una lista blanca y la
 * dirección (`asc|desc`) para evitar inyección en la cláusula ORDER BY.
 */
trait Sortable
{
    protected function applySorting(
        Builder $query,
        Request $request,
        array $allowedColumns,
        string $defaultCol = 'created_at',
        string $defaultDir = 'desc'
    ): void {
        $sortBy = $request->filled('sort_by') ? $request->sort_by : $defaultCol;
        if (!in_array($sortBy, $allowedColumns, true)) {
            $sortBy = $defaultCol;
        }

        $sortDir = strtolower((string) $request->get('sort_dir', $defaultDir));
        $sortDir = in_array($sortDir, ['asc', 'desc'], true) ? $sortDir : $defaultDir;

        $query->orderBy($sortBy, $sortDir);
    }
}
