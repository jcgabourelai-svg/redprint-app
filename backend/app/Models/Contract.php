<?php

namespace App\Models;

use App\Enums\ContractStatus;
use App\Enums\InvoiceStatus;
use App\Enums\VisitFrequency;
use App\Traits\Searchable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

class Contract extends Model
{
    use Searchable;

    protected $table = 'contracts';

    protected $fillable = [
        'cliente_id',
        'codigo_negocio',
        'fecha_inicio',
        'fecha_fin',
        'tarifa_base',
        'paginas_incluidas',
        'costo_pag_excedente',
        'dias_gracia',
        'frecuencia_visitas',
        'dias_adelanto',
        'dia_visita',
        'estado',
        'creado_por',
        'fecha_creacion',
    ];

    protected $appends = ['rentabilidad', 'ingresos', 'costos', 'margen'];

    protected function casts(): array
    {
        return [
            'fecha_inicio' => 'date',
            'fecha_fin' => 'date',
            'tarifa_base' => 'decimal:2',
            'paginas_incluidas' => 'integer',
            'costo_pag_excedente' => 'decimal:4',
            'dias_gracia' => 'integer',
            'frecuencia_visitas' => VisitFrequency::class,
            'dias_adelanto' => 'integer',
            'dia_visita' => 'integer',
            'estado' => ContractStatus::class,
            'fecha_creacion' => 'datetime',
        ];
    }

    protected $withCount = [
        'printers',
    ];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'cliente_id');
    }

    public function printers(): BelongsToMany
    {
        return $this->belongsToMany(Printer::class, 'contract_printer', 'contrato_id', 'impresora_id')
            ->withPivot([
                'id', 'fecha_asignacion', 'fecha_liberacion', 'activa', 'lectura_inicial',
                'lectura_final', 'fecha_lectura_final', 'motivo_liberacion',
                'justificacion_sin_lectura', 'reemplaza_a', 'alias', 'color',
            ])
            ->withTimestamps();
    }

    public function activePrinters(): BelongsToMany
    {
        return $this->printers()->wherePivot('activa', true);
    }

    /**
     * Plan de modelos contratados (intención comercial). Nunca es fuente de
     * cobro: el pivot contract_printer sigue siendo la única verdad de las
     * asignaciones físicas (D16).
     */
    public function planImpresoras(): HasMany
    {
        return $this->hasMany(ContractPrinterPlan::class, 'contrato_id');
    }

    public function visits(): HasMany
    {
        return $this->hasMany(Visit::class, 'contrato_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creado_por');
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'contrato_id');
    }

    public function calculateEstimatedAmount(int $pagesConsumed): float
    {
        $excess = max(0, $pagesConsumed - $this->paginas_incluidas);
        return (float) ($this->tarifa_base + ($excess * $this->costo_pag_excedente));
    }

    /**
     * Ingresos (cobrado) atribuidos a este contrato según D19:
     * - Factura mono-contrato (contrato_id del encabezado = este contrato):
     *   atribuye su monto_pagado completo.
     * - Factura multi-contrato (agrupada por cliente): atribuye
     *   monto_pagado x (Σ detalles del contrato / monto_total), con guard
     *   monto_total > 0.
     * Los BORRADORES no aportan (aún no son cuenta por cobrar).
     * Mismo patrón de costo por-contrato que el resto de $appends (N+1
     * pre-existente, documentado; fuera de alcance optimizarlo aquí).
     */
    public function getIngresosAttribute(): float
    {
        $facturas = Invoice::where('cliente_id', $this->cliente_id)
            ->where('estado', '!=', InvoiceStatus::BORRADOR)
            ->where(function ($query) {
                $query->where('contrato_id', $this->id)
                    ->orWhereHas('details', fn ($d) => $d->where('contrato_id', $this->id));
            })
            ->get(['id', 'contrato_id', 'monto_pagado', 'monto_total']);

        if ($facturas->isEmpty()) {
            return 0.0;
        }

        $shares = DB::table('invoice_details')
            ->where('contrato_id', $this->id)
            ->whereIn('factura_id', $facturas->modelKeys())
            ->groupBy('factura_id')
            ->selectRaw('factura_id, SUM(monto_calculado) AS total')
            ->pluck('total', 'factura_id');

        $ingresos = 0.0;
        foreach ($facturas as $factura) {
            if ($factura->contrato_id !== null && (int) $factura->contrato_id === (int) $this->id) {
                $ingresos += (float) $factura->monto_pagado;
                continue;
            }

            $montoTotal = (float) $factura->monto_total;
            if ($montoTotal <= 0.0) {
                continue;
            }

            $share = (float) ($shares[$factura->id] ?? 0);
            $ingresos += round((float) $factura->monto_pagado * ($share / $montoTotal), 2);
        }

        return round($ingresos, 2);
    }

    public function getCostosAttribute(): float
    {
        $maintenanceCost = $this->printers->sum(function ($printer) {
            return $printer->maintenanceOrders()->sum('costo_total');
        });

        $expenseCost = $this->printers->sum(function ($printer) {
            return $printer->expenses()->sum('monto');
        });

        return (float) ($maintenanceCost + $expenseCost);
    }

    public function getRentabilidadAttribute(): float
    {
        return $this->ingresos - $this->costos;
    }

    public function getMargenAttribute(): float
    {
        return round(($this->rentabilidad / max($this->ingresos, 1)) * 100, 2);
    }
}
