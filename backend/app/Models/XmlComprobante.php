<?php

namespace App\Models;

use App\Enums\TipoComprobante;
use App\Traits\Searchable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class XmlComprobante extends Model
{
    use Searchable;

    protected $table = 'xml_comprobantes';

    protected $fillable = [
        'uuid',
        'version',
        'serie',
        'folio',
        'serie_folio',
        'tipo_comprobante',
        'fecha_emision',
        'moneda',
        'tipo_cambio',
        'forma_pago',
        'metodo_pago',
        'lugar_expedicion',
        'condiciones_de_pago',
        'confirmacion',
        'rfc_emisor',
        'nombre_emisor',
        'regimen_fiscal_emisor',
        'rfc_receptor',
        'nombre_receptor',
        'uso_cfdi',
        'regimen_fiscal_receptor',
        'domicilio_fiscal_receptor',
        'subtotal',
        'descuento',
        'total',
        'total_impuestos_trasladados',
        'total_impuestos_retenidos',
        'iva_trasladado',
        'iva_retenido',
        'contenido_xml',
        'estado_sat',
        'notas',
        'receptor_id',
        'creado_por',
        'fecha_creacion',
    ];

    protected $appends = ['estado_conciliacion', 'estado_cliente'];

    protected function casts(): array
    {
        return [
            'fecha_emision' => 'datetime',
            'tipo_cambio' => 'decimal:4',
            'subtotal' => 'decimal:2',
            'descuento' => 'decimal:2',
            'total' => 'decimal:2',
            'total_impuestos_trasladados' => 'decimal:2',
            'total_impuestos_retenidos' => 'decimal:2',
            'iva_trasladado' => 'decimal:2',
            'iva_retenido' => 'decimal:2',
            'tipo_comprobante' => TipoComprobante::class,
            'fecha_creacion' => 'datetime',
        ];
    }

    public function conceptos(): HasMany
    {
        return $this->hasMany(XmlConcepto::class, 'xml_comprobante_id');
    }

    public function invoice(): HasOne
    {
        return $this->hasOne(Invoice::class, 'xml_comprobante_id');
    }

    public function receptor(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'receptor_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creado_por');
    }

    public function getEstadoConciliacionAttribute(): string
    {
        // Si la relacion esta eager-loaded (listados) se usa la cache para no
        // disparar una query por fila (N+1). Si no esta cargada, se consulta.
        if ($this->relationLoaded('invoice')) {
            return $this->invoice !== null ? 'conciliado' : 'sin_factura';
        }
        return $this->invoice()->exists() ? 'conciliado' : 'sin_factura';
    }

    public function getEstadoClienteAttribute(): string
    {
        return $this->receptor_id !== null ? 'asignado' : 'sin_cliente';
    }

    public function scopeSinFactura($query)
    {
        return $query->whereDoesntHave('invoice');
    }

    public function scopeSinCliente($query)
    {
        return $query->whereNull('receptor_id');
    }
}
