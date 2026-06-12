<?php

namespace App\Http\Controllers;

use App\Models\BankMovement;
use App\Models\BankAccount;
use App\Models\Payment;
use App\Models\SupplierPayment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReconciliationController extends Controller
{
    public function movements(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'cuenta_bancaria_id' => 'required|exists:bank_accounts,id',
            'periodo' => 'required|date_format:Y-m'
        ]);

        $periodo = $validated['periodo'];
        $cuentaBancariaId = $validated['cuenta_bancaria_id'];

        $movements = BankMovement::where('cuenta_bancaria_id', $cuentaBancariaId)
            ->whereRaw("DATE_FORMAT(fecha, '%Y-%m') = ?", [$periodo])
            ->orderBy('fecha')
            ->get();

        $grouped = $movements->groupBy('conciliacion_status');

        $resumen = [
            'PENDIENTE' => $grouped->get('PENDIENTE', collect())->count(),
            'CONCILIADO' => $grouped->get('CONCILIADO', collect())->count(),
            'NO_CONCILIADO' => $grouped->get('NO_CONCILIADO', collect())->count()
        ];

        return response()->json([
            'movements' => $movements,
            'resumen' => $resumen
        ]);
    }

    public function summary(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'cuenta_bancaria_id' => 'required|exists:bank_accounts,id',
            'periodo' => 'required|date_format:Y-m'
        ]);

        $periodo = $validated['periodo'];
        $cuentaBancariaId = $validated['cuenta_bancaria_id'];

        $cuenta = BankAccount::findOrFail($cuentaBancariaId);

        $movements = BankMovement::where('cuenta_bancaria_id', $cuentaBancariaId)
            ->whereRaw("DATE_FORMAT(fecha, '%Y-%m') = ?", [$periodo])
            ->get();

        $totalDepositos = $movements->where('tipo', 'DEPOSITO')->sum('monto');
        $totalRetiros = $movements->where('tipo', 'RETIRO')->sum('monto');
        $saldoCalculado = $cuenta->saldo_inicial + $totalDepositos - $totalRetiros;

        $conciliados = $movements->where('conciliacion_status', 'CONCILIADO')->count();
        $pendientes = $movements->where('conciliacion_status', 'PENDIENTE')->count();
        $noConciliados = $movements->where('conciliacion_status', 'NO_CONCILIADO')->count();

        return response()->json([
            'total_depositos' => $totalDepositos,
            'total_retiros' => $totalRetiros,
            'saldo_calculado' => $saldoCalculado,
            'conciliados' => $conciliados,
            'pendientes' => $pendientes,
            'no_conciliados' => $noConciliados
        ]);
    }

    public function link(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'movimiento_id' => 'required|exists:bank_movements,id',
            'transaccion_tipo' => 'required|in:payment,supplier_payment',
            'transaccion_id' => 'required'
        ]);

        return DB::transaction(function () use ($validated) {
            $movimiento = BankMovement::findOrFail($validated['movimiento_id']);

            if ($movimiento->conciliacion_status !== 'PENDIENTE') {
                throw ValidationException::withMessages([
                    'movimiento_id' => ['El movimiento debe estar en estado PENDIENTE para ser conciliado']
                ]);
            }

            $transaccion = null;

            switch ($validated['transaccion_tipo']) {
                case 'payment':
                    $transaccion = Payment::findOrFail($validated['transaccion_id']);
                    break;
                case 'supplier_payment':
                    $transaccion = SupplierPayment::findOrFail($validated['transaccion_id']);
                    break;
            }

            if (!$transaccion) {
                throw ValidationException::withMessages([
                    'transaccion_id' => ['La transacción no existe']
                ]);
            }

            $movimiento->update([
                'conciliacion_status' => 'CONCILIADO',
                'transaccion_vinculada_id' => $transaccion->id
            ]);

            $transaccion->update([
                'movimiento_bancario_id' => $movimiento->id
            ]);

            return response()->json([
                'message' => 'Movimiento conciliado exitosamente'
            ]);
        });
    }
}