<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvoiceDetail extends Model
{
    protected $table = 'invoice_details';

    protected $fillable = [
        'factura_id',
        'contrato_id',
        'impresora_id',
        'lectura_id',
        'paginas_consumidas',
        'monto_calculado',
    ];

    protected function casts(): array
    {
        return [
            'paginas_consumidas' => 'integer',
            'monto_calculado' => 'decimal:2',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'factura_id');
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'contrato_id');
    }

    public function printer(): BelongsTo
    {
        return $this->belongsTo(Printer::class, 'impresora_id');
    }

    public function reading(): BelongsTo
    {
        return $this->belongsTo(Reading::class, 'lectura_id');
    }
}
