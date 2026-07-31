<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class XmlConcepto extends Model
{
    protected $table = 'xml_conceptos';

    protected $fillable = [
        'xml_comprobante_id',
        'clave_prod_serv',
        'no_identificacion',
        'cantidad',
        'clave_unidad',
        'unidad',
        'descripcion',
        'valor_unitario',
        'importe',
        'descuento',
        'objeto_imp',
    ];

    protected function casts(): array
    {
        return [
            'cantidad' => 'decimal:4',
            'valor_unitario' => 'decimal:2',
            'importe' => 'decimal:2',
            'descuento' => 'decimal:2',
        ];
    }

    public function comprobante(): BelongsTo
    {
        return $this->belongsTo(XmlComprobante::class, 'xml_comprobante_id');
    }
}
