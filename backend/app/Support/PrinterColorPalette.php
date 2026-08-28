<?php

namespace App\Support;

/**
 * Paleta de identidad por impresora dentro de un contrato. El backend es la
 * fuente de verdad de las keys (viven en contract_printer.color); web y movil
 * mapean key -> hex localmente. Keys sin acentos porque se persisten en BD.
 */
final class PrinterColorPalette
{
    public const KEYS = ['azul', 'turquesa', 'verde', 'ambar', 'naranja', 'morado', 'rosa', 'gris'];
}
