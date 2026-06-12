<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class CodeGeneratorService
{
    public function generatePrinterCode(): string
    {
        $date = now()->format('Ymd');
        $prefix = "IMP-{$date}-";

        $lastCode = DB::table('printers')
            ->where('codigo_negocio', 'like', $prefix . '%')
            ->lockForUpdate()
            ->orderBy('codigo_negocio', 'desc')
            ->value('codigo_negocio');

        $seq = 1;
        if ($lastCode) {
            $lastSeq = (int) substr($lastCode, strlen($prefix));
            $seq = $lastSeq + 1;
        }

        return $prefix . str_pad($seq, 4, '0', STR_PAD_LEFT);
    }

    public function generateContractCode(): string
    {
        $prefix = 'CTR-';

        $lastCode = DB::table('contracts')
            ->where('codigo_negocio', 'like', $prefix . '%')
            ->lockForUpdate()
            ->orderBy('codigo_negocio', 'desc')
            ->value('codigo_negocio');

        $seq = 1;
        if ($lastCode) {
            $lastSeq = (int) substr($lastCode, strlen($prefix));
            $seq = $lastSeq + 1;
        }

        return $prefix . str_pad($seq, 4, '0', STR_PAD_LEFT);
    }
}
