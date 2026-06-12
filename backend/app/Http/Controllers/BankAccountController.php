<?php

namespace App\Http\Controllers;

use App\Http\Resources\BankAccountResource;
use App\Http\Resources\BankMovementResource;
use App\Models\BankAccount;
use App\Models\BankMovement;
use Illuminate\Http\Request;

class BankAccountController extends Controller
{
    public function index(Request $request)
    {
        $query = BankAccount::withCount('movements');

        if ($request->has('activo')) {
            $query->where('activo', $request->boolean('activo'));
        }

        $accounts = $query->get();

        return BankAccountResource::collection($accounts);
    }

    public function show($id)
    {
        $account = BankAccount::withCount('movements')->findOrFail($id);

        return BankAccountResource::make($account);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'banco' => 'required|string|max:255',
            'tipo_cuenta' => 'required|string|max:255',
            'numero_cuenta' => 'required|string|unique:bank_accounts,numero_cuenta',
            'moneda' => 'required|string|max:3',
            'saldo_inicial' => 'required|numeric|min:0',
            'descripcion' => 'nullable|string|max:500',
            'activo' => 'nullable|boolean',
        ]);

        $validated['saldo'] = $validated['saldo_inicial'];
        $validated['socio_id'] = $request->user()->id;
        $validated['activo'] = $validated['activo'] ?? true;

        $account = BankAccount::create($validated);

        return BankAccountResource::make($account);
    }

    public function update(Request $request, $id)
    {
        $account = BankAccount::findOrFail($id);

        $validated = $request->validate([
            'banco' => 'sometimes|string|max:255',
            'tipo_cuenta' => 'sometimes|string|max:255',
            'numero_cuenta' => 'sometimes|string|unique:bank_accounts,numero_cuenta,' . $account->id,
            'moneda' => 'sometimes|string|max:3',
            'descripcion' => 'nullable|string|max:500',
            'activo' => 'nullable|boolean',
        ]);

        $account->update($validated);

        return BankAccountResource::make($account);
    }

    public function movements(Request $request, $accountId)
    {
        $account = BankAccount::where('id', $accountId)->where('activo', true)->firstOrFail();

        $query = $account->movements()->with(['cuenta', 'socio']);

        if ($request->has('tipo')) {
            $query->where('tipo', $request->input('tipo'));
        }

        if ($request->has('conciliacion_status')) {
            $query->where('conciliacion_status', $request->input('conciliacion_status'));
        }

        if ($request->has('fecha_desde')) {
            $query->where('fecha', '>=', $request->input('fecha_desde'));
        }

        if ($request->has('fecha_hasta')) {
            $query->where('fecha', '<=', $request->input('fecha_hasta'));
        }

        $movements = $query->orderBy('fecha', 'desc')->paginate();

        return BankMovementResource::collection($movements);
    }
}