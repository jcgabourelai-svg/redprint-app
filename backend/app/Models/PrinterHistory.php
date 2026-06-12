<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PrinterHistory extends Model
{
    protected $table = 'printer_histories';

    protected $fillable = [
        'impresora_id',
        'tipo_evento',
        'descripcion',
        'datos_adicionales',
        'socio_id',
        'fecha',
    ];

    protected function casts(): array
    {
        return [
            'datos_adicionales' => 'array',
            'fecha' => 'datetime',
        ];
    }

    public function printer(): BelongsTo
    {
        return $this->belongsTo(Printer::class, 'impresora_id');
    }

    public function socio(): BelongsTo
    {
        return $this->belongsTo(User::class, 'socio_id');
    }
}
