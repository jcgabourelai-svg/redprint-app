<?php

namespace App\Services\Cfdi;

use App\Exceptions\BusinessRuleException;
use SimpleXMLElement;

/**
 * Parser de CFDI (XML del SAT) a un array normalizado.
 *
 * Soporta las versiones 4.0 y 3.3, detectando la version por el namespace del
 * nodo raiz. Endurecido contra XXE: NO se usa LIBXML_NOENT y se confia en que
 * libxml >= 2.9 desactiva la carga de entidades externas por defecto.
 */
class CfdiParser
{
    private const NS_CFDI_4 = 'http://www.sat.gob.mx/cfd/4';
    private const NS_CFDI_3 = 'http://www.sat.gob.mx/cfd/3';
    private const NS_TFD = 'http://www.sat.gob.mx/TimbreFiscalDigital';

    /**
     * @return array{
     *     uuid: string,
     *     version: string,
     *     serie: string|null,
     *     folio: string|null,
     *     serie_folio: string|null,
     *     tipo_comprobante: string,
     *     fecha_emision: string,
     *     moneda: string|null,
     *     tipo_cambio: float|null,
     *     forma_pago: string|null,
     *     metodo_pago: string|null,
     *     lugar_expedicion: string|null,
     *     condiciones_de_pago: string|null,
     *     confirmacion: string|null,
     *     rfc_emisor: string,
     *     nombre_emisor: string|null,
     *     regimen_fiscal_emisor: string|null,
     *     rfc_receptor: string,
     *     nombre_receptor: string|null,
     *     uso_cfdi: string|null,
     *     regimen_fiscal_receptor: string|null,
     *     domicilio_fiscal_receptor: string|null,
     *     subtotal: float,
     *     descuento: float|null,
     *     total: float,
     *     total_impuestos_trasladados: float|null,
     *     total_impuestos_retenidos: float|null,
     *     iva_trasladado: float|null,
     *     iva_retenido: float|null,
     *     contenido_xml: string,
     *     conceptos: list<array<string,mixed>>,
     * }
     *
     * @throws BusinessRuleException Si el XML esta malformado o no es un CFDI valido.
     */
    public function parse(string $xmlContent): array
    {
        $prev = libxml_use_internal_errors(true);

        try {
            // LIBXML_NOCDATA solo fusiona secciones CDATA en texto; NO carga
            // entidades externas (eso seria LIBXML_NOENT, que se evita a proposito).
            $xml = simplexml_load_string($xmlContent, null, LIBXML_NOCDATA);
        } finally {
            libxml_use_internal_errors($prev);
        }

        if ($xml === false || $xml->getName() !== 'Comprobante') {
            throw new BusinessRuleException('El archivo no es un CFDI valido: nodo raiz incorrecto o XML malformado.');
        }

        $cfdiNs = $this->detectarNamespaceCfdi($xml);
        if ($cfdiNs === null) {
            throw new BusinessRuleException('El archivo no es un CFDI valido: namespace del SAT no encontrado.');
        }

        $version = $cfdiNs === self::NS_CFDI_4 ? '4.0' : '3.3';

        $attrs = $xml->attributes();
        $children = $xml->children($cfdiNs);

        $serie = $this->strOrNull((string) $attrs->Serie);
        $folio = $this->strOrNull((string) $attrs->Folio);
        $serieFolio = ($serie !== null || $folio !== null) ? $serie . $folio : null;

        $tipoComprobante = strtoupper($this->strOrNull((string) $attrs->TipoDeComprobante) ?? '');
        if ($tipoComprobante === '') {
            throw new BusinessRuleException('El CFDI no incluye el TipoDeComprobante.');
        }

        $fecha = $this->strOrNull((string) $attrs->Fecha);
        if ($fecha === null) {
            throw new BusinessRuleException('El CFDI no incluye la Fecha de emision.');
        }

        $uuid = $this->extraerUuid($children);
        if ($uuid === null) {
            throw new BusinessRuleException('El CFDI no incluye el UUID (TimbreFiscalDigital).');
        }

        [$ivaTrasladado, $ivaRetenido, $totalTrasladados, $totalRetenidos] = $this->extraerImpuestos($children, $cfdiNs);

        [$rfcEmisor, $nombreEmisor, $regimenEmisor] = $this->extraerEmisor($children);
        [$rfcReceptor, $nombreReceptor, $usoCfdi, $regimenReceptor, $domicilioReceptor] = $this->extraerReceptor($children);

        return [
            'uuid' => $uuid,
            'version' => $version,
            'serie' => $serie,
            'folio' => $folio,
            'serie_folio' => $serieFolio,
            'tipo_comprobante' => $tipoComprobante,
            'fecha_emision' => $fecha,
            'moneda' => $this->strOrNull((string) $attrs->Moneda),
            'tipo_cambio' => $this->numOrNull((string) $attrs->TipoCambio),
            'forma_pago' => $this->strOrNull((string) $attrs->FormaPago),
            'metodo_pago' => $this->strOrNull((string) $attrs->MetodoPago),
            'lugar_expedicion' => $this->strOrNull((string) $attrs->LugarExpedicion),
            'condiciones_de_pago' => $this->strOrNull((string) $attrs->CondicionesDePago),
            'confirmacion' => $this->strOrNull((string) $attrs->Confirmacion),
            'rfc_emisor' => $rfcEmisor,
            'nombre_emisor' => $nombreEmisor,
            'regimen_fiscal_emisor' => $regimenEmisor,
            'rfc_receptor' => $rfcReceptor,
            'nombre_receptor' => $nombreReceptor,
            'uso_cfdi' => $usoCfdi,
            'regimen_fiscal_receptor' => $regimenReceptor,
            'domicilio_fiscal_receptor' => $domicilioReceptor,
            'subtotal' => $this->num((string) $attrs->SubTotal),
            'descuento' => $this->numOrNull((string) $attrs->Descuento),
            'total' => $this->num((string) $attrs->Total),
            'total_impuestos_trasladados' => $totalTrasladados,
            'total_impuestos_retenidos' => $totalRetenidos,
            'iva_trasladado' => $ivaTrasladado,
            'iva_retenido' => $ivaRetenido,
            'contenido_xml' => $xmlContent,
            'conceptos' => $this->extraerConceptos($children),
        ];
    }

    private function detectarNamespaceCfdi(SimpleXMLElement $xml): ?string
    {
        foreach ($xml->getDocNamespaces(true) as $uri) {
            if ($uri === self::NS_CFDI_4 || $uri === self::NS_CFDI_3) {
                return $uri;
            }
        }

        return null;
    }

    private function extraerUuid(SimpleXMLElement $children): ?string
    {
        $complemento = $children->Complemento;
        if ($complemento === null) {
            return null;
        }

        $tfd = $complemento->children(self::NS_TFD)->TimbreFiscalDigital;
        if ($tfd === null) {
            return null;
        }

        return $this->strOrNull((string) $tfd->attributes()->UUID);
    }

    /**
     * @return array{0:float|null,1:float|null,2:float|null,3:float|null}
     *               [iva_trasladado, iva_retenido, total_trasladados, total_retenidos]
     */
    private function extraerImpuestos(SimpleXMLElement $children, string $cfdiNs): array
    {
        $ivaTrasladado = null;
        $ivaRetenido = null;
        $totalTrasladados = null;
        $totalRetenidos = null;

        $impuestos = $children->Impuestos;
        if ($impuestos !== null) {
            $impAttrs = $impuestos->attributes();
            $totalTrasladados = $this->numOrNull((string) $impAttrs->TotalImpuestosTrasladados);
            $totalRetenidos = $this->numOrNull((string) $impAttrs->TotalImpuestosRetenidos);

            if (isset($impuestos->Traslados)) {
                foreach ($impuestos->Traslados->Traslado as $t) {
                    $ta = $t->attributes();
                    if ((string) $ta->Impuesto === '002') {
                        $ivaTrasladado = ($ivaTrasladado ?? 0.0) + (float) $ta->Importe;
                    }
                }
            }

            if (isset($impuestos->Retenciones)) {
                foreach ($impuestos->Retenciones->Retencion as $r) {
                    $ra = $r->attributes();
                    if ((string) $ra->Impuesto === '002') {
                        $ivaRetenido = ($ivaRetenido ?? 0.0) + (float) $ra->Importe;
                    }
                }
            }
        }

        return [$ivaTrasladado, $ivaRetenido, $totalTrasladados, $totalRetenidos];
    }

    /**
     * @return array{0:string,1:string|null,2:string|null}
     *               [rfc_emisor, nombre_emisor, regimen_fiscal_emisor]
     */
    private function extraerEmisor(SimpleXMLElement $children): array
    {
        $emisor = $children->Emisor;
        if ($emisor === null) {
            throw new BusinessRuleException('El CFDI no incluye el nodo Emisor.');
        }

        $a = $emisor->attributes();
        $rfc = $this->strOrNull((string) $a->Rfc);
        if ($rfc === null) {
            throw new BusinessRuleException('El CFDI no incluye el RFC del Emisor.');
        }

        return [
            $rfc,
            $this->strOrNull((string) $a->Nombre),
            $this->strOrNull((string) $a->RegimenFiscal),
        ];
    }

    /**
     * @return array{0:string,1:string|null,2:string|null,3:string|null,4:string|null}
     */
    private function extraerReceptor(SimpleXMLElement $children): array
    {
        $receptor = $children->Receptor;
        if ($receptor === null) {
            throw new BusinessRuleException('El CFDI no incluye el nodo Receptor.');
        }

        $a = $receptor->attributes();
        $rfc = $this->strOrNull((string) $a->Rfc);
        if ($rfc === null) {
            throw new BusinessRuleException('El CFDI no incluye el RFC del Receptor.');
        }

        return [
            $rfc,
            $this->strOrNull((string) $a->Nombre),
            $this->strOrNull((string) $a->UsoCFDI),
            $this->strOrNull((string) $a->RegimenFiscalReceptor),
            $this->strOrNull((string) $a->DomicilioFiscalReceptor),
        ];
    }

    /**
     * @return list<array<string,mixed>>
     */
    private function extraerConceptos(SimpleXMLElement $children): array
    {
        $out = [];
        $conceptos = $children->Conceptos;
        if ($conceptos === null) {
            return $out;
        }

        foreach ($conceptos->Concepto as $c) {
            $a = $c->attributes();
            $out[] = [
                'clave_prod_serv' => $this->strOrNull((string) $a->ClaveProdServ),
                'no_identificacion' => $this->strOrNull((string) $a->NoIdentificacion),
                'cantidad' => $this->num((string) $a->Cantidad),
                'clave_unidad' => $this->strOrNull((string) $a->ClaveUnidad),
                'unidad' => $this->strOrNull((string) $a->Unidad),
                'descripcion' => (string) $a->Descripcion,
                'valor_unitario' => $this->numOrNull((string) $a->ValorUnitario),
                'importe' => $this->num((string) $a->Importe),
                'descuento' => $this->numOrNull((string) $a->Descuento),
                'objeto_imp' => $this->strOrNull((string) $a->ObjetoImp),
            ];
        }

        return $out;
    }

    private function strOrNull(string $value): ?string
    {
        $v = trim($value);
        return $v !== '' ? $v : null;
    }

    private function numOrNull(string $value): ?float
    {
        if (trim($value) === '') {
            return null;
        }
        return (float) $value;
    }

    private function num(string $value): float
    {
        return trim($value) === '' ? 0.0 : (float) $value;
    }
}
