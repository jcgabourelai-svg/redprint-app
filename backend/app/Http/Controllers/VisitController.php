<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreVisitRequest;
use App\Http\Resources\VisitResource;
use App\Enums\VisitStatus;
use App\Models\Visit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VisitController extends Controller
{
    public function index(Request $request)
    {
        $visits = Visit::with(['client', 'contract', 'socio', 'readings'])
            ->when($request->estado, fn($q, $e) => $q->where('estado', $e))
            ->when($request->cliente_id, fn($q, $id) => $q->where('cliente_id', $id))
            ->when($request->socio_id, fn($q, $id) => $q->where('socio_id', $id))
            ->when($request->month, fn($q, $m) => $q->whereMonth('fecha_programada', $m))
            ->when($request->year, fn($q, $y) => $q->whereYear('fecha_programada', $y))
            ->orderBy('fecha_programada', 'asc')
            ->paginate($request->per_page ?? 15);

        return VisitResource::collection($visits);
    }

    public function show(Visit $visit): VisitResource
    {
        $visit->load(['client', 'contract', 'socio', 'readings.printer']);
        return new VisitResource($visit);
    }

    public function store(StoreVisitRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['creado_por'] = $request->user()->id;
        $data['estado'] = VisitStatus::PENDIENTE;
        $data['fecha_creacion'] = now();

        $visit = Visit::create($data);
        return response()->json(new VisitResource($visit->load(['client', 'contract', 'socio'])), 201);
    }

    public function update(Request $request, Visit $visit): VisitResource
    {
        $data = $request->validate([
            'fecha_programada' => 'sometimes|date',
            'socio_id' => 'sometimes|exists:users,id',
            'notas' => 'nullable|string',
        ]);

        if (isset($data['fecha_programada']) && $visit->estado === VisitStatus::PENDIENTE) {
            $data['estado'] = VisitStatus::REPROGRAMADA;
        }

        $visit->update($data);
        return new VisitResource($visit->fresh());
    }

    public function complete(Request $request, Visit $visit): VisitResource
    {
        $visit->update([
            'estado' => VisitStatus::COMPLETADA,
            'fecha_realizada' => now(),
        ]);

        return new VisitResource($visit->fresh());
    }

    public function reschedule(Request $request, Visit $visit): VisitResource
    {
        $data = $request->validate([
            'fecha_programada' => 'required|date',
        ]);

        $visit->update([
            'fecha_programada' => $data['fecha_programada'],
            'estado' => VisitStatus::REPROGRAMADA,
        ]);

        return new VisitResource($visit->fresh());
    }
}
