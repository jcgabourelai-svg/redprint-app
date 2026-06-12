<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PeriodValidation extends Model
{
    protected $table = 'period_validations';

    protected $fillable = [
        'period_close_id',
        'nombre',
        'estado',
        'mensaje',
        'link',
    ];

    protected function casts(): array
    {
        return [
            'estado' => 'string',
        ];
    }

    public function periodClose(): BelongsTo
    {
        return $this->belongsTo(PeriodClose::class, 'period_close_id');
    }
}
