<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContractPrinterPlan extends Model
{
    protected $table = 'contract_printer_plan';

    protected $fillable = [
        'contrato_id',
        'printer_model_id',
        'cantidad',
    ];

    protected function casts(): array
    {
        return [
            'cantidad' => 'integer',
        ];
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'contrato_id');
    }

    public function printerModel(): BelongsTo
    {
        return $this->belongsTo(PrinterModel::class, 'printer_model_id');
    }
}
