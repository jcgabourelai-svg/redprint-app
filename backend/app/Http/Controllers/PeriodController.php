<?php

namespace App\Http\Controllers;

use App\Http\Resources\PeriodCloseResource;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\BankMovement;
use App\Models\SupplierPayment;
use App\Models\PrinterExpense;
use App\Models\Purchase;
use App\Models\PeriodClose;
use App\Models\PeriodValidation;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Carbon\Carbon;

class PeriodController extends Controller
{
    public function current(): JsonResponse
    {
        $periodo = now()->format('Y-m');

        $periodClose = PeriodClose::firstOrCreate(
            ['periodo' => $periodo],
            [
                'estado' => 'abierto',
                'fecha_cierre' => null,
                'cerrado_por' => null,
                'ingresos' => 0,
                'egresos' => 0,
                'rentabilidad' => 0,
                'facturas_emitidas' => 0,
                'facturas_pagadas' => 0,
                'facturas_pendientes' => 0,
                'gastos_registrados' => 0,
                'movimientos_bancarios' => 0,
                'movimientos_conciliados' => 0,
                'movimientos_pendientes' => 0,
            ]
        );

        $periodStart = Carbon::parse($periodo)->startOfMonth();
        $periodEnd = Carbon::parse($periodo)->endOfMonth();

        $ingresos = Payment::whereBetween('fecha', [$periodStart, $periodEnd])->sum('monto');

        $egresos = SupplierPayment::whereBetween('fecha', [$periodStart, $periodEnd])->sum('monto')
            + PrinterExpense::whereBetween('fecha', [$periodStart, $periodEnd])->sum('monto')
            + Purchase::whereBetween('fecha', [$periodStart, $periodEnd])->sum('monto');

        $facturasEmitidas = Invoice::whereBetween('fecha_emision', [$periodStart, $periodEnd])->count();

        $facturasPagadas = Invoice::where('saldo_pendiente', 0)
            ->whereBetween('fecha_emision', [$periodStart, $periodEnd])
            ->count();

        $facturasPendientes = Invoice::where('saldo_pendiente', '>', 0)
            ->whereBetween('fecha_emision', [$periodStart, $periodEnd])
            ->count();

        $movimientosBancarios = BankMovement::whereBetween('fecha', [$periodStart, $periodEnd])->count();

        $movimientosConciliados = BankMovement::where('tipo', 'conciliado')
            ->whereBetween('fecha', [$periodStart, $periodEnd])
            ->count();

        $movimientosPendientes = BankMovement::where('tipo', 'pendiente')
            ->whereBetween('fecha', [$periodStart, $periodEnd])
            ->count();

        $rentabilidad = $egresos > 0 ? ($ingresos - $egresos) / $egresos * 100 : 0;

        $periodClose->ingresos = $ingresos;
        $periodClose->egresos = $egresos;
        $periodClose->rentabilidad = $rentabilidad;
        $periodClose->facturas_emitidas = $facturasEmitidas;
        $periodClose->facturas_pagadas = $facturasPagadas;
        $periodClose->facturas_pendientes = $facturasPendientes;
        $periodClose->gastos_registrados = $egresos;
        $periodClose->movimientos_bancarios = $movimientosBancarios;
        $periodClose->movimientos_conciliados = $movimientosConciliados;
        $periodClose->movimientos_pendientes = $movimientosPendientes;

        return response()->json(new PeriodCloseResource($periodClose));
    }

    public function history(Request $request): JsonResponse
    {
        $periods = PeriodClose::where('estado', 'cerrado')
            ->orderBy('periodo', 'desc')
            ->paginate(15);

        return PeriodCloseResource::collection($periods)->response();
    }

    public function close(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'periodo' => 'required|string|date_format:Y-m',
        ]);

        $periodo = $validated['periodo'];

        $periodStart = Carbon::parse($periodo)->startOfMonth();
        $periodEnd = Carbon::parse($periodo)->endOfMonth();

        $result = DB::transaction(function () use ($periodo, $periodStart, $periodEnd) {
            $periodClose = PeriodClose::firstOrCreate(
                ['periodo' => $periodo],
                [
                    'estado' => 'abierto',
                    'fecha_cierre' => null,
                    'cerrado_por' => null,
                    'ingresos' => 0,
                    'egresos' => 0,
                    'rentabilidad' => 0,
                    'facturas_emitidas' => 0,
                    'facturas_pagadas' => 0,
                    'facturas_pendientes' => 0,
                    'gastos_registrados' => 0,
                    'movimientos_bancarios' => 0,
                    'movimientos_conciliados' => 0,
                    'movimientos_pendientes' => 0,
                ]
            );

            if ($periodClose->estado === 'cerrado') {
                throw ValidationException::withMessages([
                    'periodo' => ['El periodo ya está cerrado'],
                ]);
            }

            $ingresos = Payment::whereBetween('fecha', [$periodStart, $periodEnd])->sum('monto');

            $egresos = SupplierPayment::whereBetween('fecha', [$periodStart, $periodEnd])->sum('monto')
                + PrinterExpense::whereBetween('fecha', [$periodStart, $periodEnd])->sum('monto')
                + Purchase::whereBetween('fecha', [$periodStart, $periodEnd])->sum('monto');

            $facturasEmitidas = Invoice::whereBetween('fecha_emision', [$periodStart, $periodEnd])->count();

            $facturasPagadas = Invoice::where('saldo_pendiente', 0)
                ->whereBetween('fecha_emision', [$periodStart, $periodEnd])
                ->count();

            $facturasPendientes = Invoice::where('saldo_pendiente', '>', 0)
                ->whereBetween('fecha_emision', [$periodStart, $periodEnd])
                ->count();

            $movimientosBancarios = BankMovement::whereBetween('fecha', [$periodStart, $periodEnd])->count();

            $movimientosConciliados = BankMovement::where('tipo', 'conciliado')
                ->whereBetween('fecha', [$periodStart, $periodEnd])
                ->count();

            $movimientosPendientes = BankMovement::where('tipo', 'pendiente')
                ->whereBetween('fecha', [$periodStart, $periodEnd])
                ->count();

            $rentabilidad = $egresos > 0 ? ($ingresos - $egresos) / $egresos * 100 : 0;

            $periodClose->ingresos = $ingresos;
            $periodClose->egresos = $egresos;
            $periodClose->rentabilidad = $rentabilidad;
            $periodClose->facturas_emitidas = $facturasEmitidas;
            $periodClose->facturas_pagadas = $facturasPagadas;
            $periodClose->facturas_pendientes = $facturasPendientes;
            $periodClose->gastos_registrados = $egresos;
            $periodClose->movimientos_bancarios = $movimientosBancarios;
            $periodClose->movimientos_conciliados = $movimientosConciliados;
            $periodClose->movimientos_pendientes = $movimientosPendientes;
            $periodClose->estado = 'cerrado';
            $periodClose->fecha_cierre = now();
            $periodClose->cerrado_por = auth()->id();
            $periodClose->save();

            PeriodValidation::create([
                'period_close_id' => $periodClose->id,
                'nombre' => 'Facturas pendientes',
                'estado' => $facturasPendientes > 0 ? 'warning' : 'ok',
                'mensaje' => $facturasPendientes > 0 ? "Hay {$facturasPendientes} facturas pendientes de pago" : 'Todas las facturas están pagadas',
            ]);

            PeriodValidation::create([
                'period_close_id' => $periodClose->id,
                'nombre' => 'Conciliación bancaria',
                'estado' => $movimientosPendientes > 0 ? 'warning' : 'ok',
                'mensaje' => $movimientosPendientes > 0 ? "Hay {$movimientosPendientes} movimientos bancarios pendientes de conciliación" : 'Todos los movimientos bancarios están conciliados',
            ]);

            PeriodValidation::create([
                'period_close_id' => $periodClose->id,
                'nombre' => 'Rentabilidad',
                'estado' => $rentabilidad >= 0 ? 'ok' : 'error',
                'mensaje' => $rentabilidad >= 0 ? "Rentabilidad positiva: {$rentabilidad}%" : "Rentabilidad negativa: {$rentabilidad}%",
            ]);

            return $periodClose;
        });

        return response()->json(new PeriodCloseResource($result->load('validations', 'cerradoPor')));
    }
}