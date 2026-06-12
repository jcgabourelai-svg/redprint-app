<?php

namespace App\Models;

use App\Enums\ExpenseType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PrinterExpense extends Model
{
    protected $table = 'printer_expenses';

    protected $fillable = [
        'impresora_id',
        'tipo',
        'monto',
        'fecha',
        'descripcion',
        'socio_id',
        'orden_mantto_id',
        'cuenta_bancaria_id',
        'comprobante',
        'fecha_creacion',
    ];

    protected function casts(): array
    {
        return [
            'tipo' => ExpenseType::class,
            'monto' => 'decimal:2',
            'fecha' => 'date',
            'fecha_creacion' => 'datetime',
        ];
    }

    public function printer(): BelongsTo
    {
        return $this->belongsTo(Printer::class, 'impresora_id');
    }

    public function maintenanceOrder(): BelongsTo
    {
        return $this->belongsTo(MaintenanceOrder::class, 'orden_mantto_id');
    }

    public function socio(): BelongsTo
    {
        return $this->belongsTo(User::class, 'socio_id');
    }
}
