<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreVisitRequest;
use App\Http\Resources\VisitResource;
use App\Enums\VisitStatus;
use App\Models\Visit;
use App\Models\User;
use App\Services\VisitSchedulerService;
use App\Traits\Sortable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class VisitController extends Controller
{
    use Sortable;

    public function index(Request $request)
    {
        $query = Visit::with(['client', 'contract', 'socio', 'readings'])
            ->when($request->estado, fn($q, $e) => $q->where('estado', $e))
            ->when($request->cliente_id, fn($q, $id) => $q->where('cliente_id', $id))
            ->when($request->contrato_id, fn($q, $id) => $q->where('contrato_id', $id))
            ->when($request->socio_id, fn($q, $id) => $q->where('socio_id', $id))
            ->when($request->month, fn($q, $m) => $q->whereMonth('fecha_programada', $m))
            ->when($request->year, fn($q, $y) => $q->whereYear('fecha_programada', $y));

        $this->applySorting($query, $request, [
            'id', 'fecha_programada', 'estado', 'created_at',
        ], 'fecha_programada', 'asc');

        $visits = $query->paginate($request->per_page ?? 15);

        return VisitResource::collection($visits);
    }

    public function show(Visit $visit): VisitResource
    {
        $visit->load([
            'client', 'contract', 'socio', 'readings.printer',
            'contract.activePrinters.latestReading',
        ]);
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

    public function update(Request $request, Visit $visit): VisitResource|JsonResponse
    {
        if (in_array($visit->estado, [VisitStatus::COMPLETADA, VisitStatus::CANCELADA, VisitStatus::OMITIDA], true)) {
            return response()->json(['message' => 'No se puede modificar una visita completada, cancelada u omitida'], 422);
        }

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

    public function destroy(Visit $visit): JsonResponse
    {
        if (in_array($visit->estado, [VisitStatus::COMPLETADA, VisitStatus::CANCELADA, VisitStatus::OMITIDA], true)) {
            return response()->json(['message' => 'No se puede cancelar una visita completada, omitida o ya cancelada'], 422);
        }

        // Cancelacion manual individual: marca como OMITIDA (no CANCELADA) para
        // que el cron no la regenere en la proxima corrida.
        $visit->update(['estado' => VisitStatus::OMITIDA]);
        return response()->json(null, 204);
    }

    /**
     * Lista ligera de usuarios activos para selectores (socios) del calendario.
     */
    public function socios(): JsonResponse
    {
        $socios = User::where('activo', true)
            ->whereDoesntHave('role', fn ($q) => $q->where('slug', 'operador-inventario'))
            ->orderBy('nombre')
            ->get(['id', 'nombre']);

        return response()->json($socios);
    }

    /**
     * Dispara manualmente la generacion de visitas recurrentes (rolling 1 mes)
     * para todos los contratos activos. Es el equivalente en UI al cron job
     * visits:generate-upcoming, util cuando no se puede garantizar que el
     * scheduler del sistema este corriendo.
     *
     * Usa un candado distribuido para evitar ejecuciones concurrentes (p. ej.
     * dos operadores o solapamiento con el cron) que podrian duplicar visitas,
     * ya que el guard anticopia del servicio es a nivel aplicacion (SELECT
     * seguido de INSERT) sin restriccion unica en BD.
     */
    public function generate(VisitSchedulerService $scheduler): JsonResponse
    {
        $lock = Cache::lock('visits:generate', 300);

        if (!$lock->get()) {
            return response()->json(['message' => 'Ya hay una generación en curso, intenta de nuevo en unos momentos'], 409);
        }

        try {
            $created = $scheduler->generateRecurringVisits();
        } finally {
            $lock->release();
        }

        return response()->json([
            'message' => 'Generacion completada',
            'creadas' => count($created),
        ]);
    }
}
