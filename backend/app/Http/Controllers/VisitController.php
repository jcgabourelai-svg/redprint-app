<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreVisitRequest;
use App\Http\Resources\ArticleDeliveryResource;
use App\Http\Resources\VisitResource;
use App\Enums\ContractStatus;
use App\Enums\VisitStatus;
use App\Models\Client;
use App\Models\PrinterHistory;
use App\Models\Visit;
use App\Models\User;
use App\Services\DeliveryService;
use App\Services\VisitSchedulerService;
use App\Services\VisitService;
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
            'client', 'contract', 'socio', 'readings.printer.assignments',
            'contract.activePrinters.latestReading',
            'deliveries.article',
            'maintenanceOrders.printer',
        ]);

        // Cambios de impresora (instalacion/retiro) vinculados a esta visita
        // via datos_adicionales->visita_id. Solo en el detalle, no en index().
        $visit->setRelation('printer_changes', PrinterHistory::query()
            ->where('datos_adicionales->visita_id', $visit->id)
            ->whereIn('tipo_evento', ['ASIGNACION_CONTRATO', 'LIBERACION_CONTRATO'])
            ->with('printer:id,marca,modelo,num_serie')
            ->orderBy('id')
            ->get());

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

    public function complete(Request $request, Visit $visit, VisitService $visitService): VisitResource
    {
        $data = $request->validate([
            'motivo_cierre' => 'nullable|string|max:1000',
        ]);

        $visit = $visitService->complete($visit, $data['motivo_cierre'] ?? null);

        return new VisitResource($visit->load(['client', 'contract', 'socio']));
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
     * Lista ligera de clientes con contrato ACTIVO y sus contratos activos,
     * para el picker de visitas espontaneas de la app movil (solo clientes
     * con contrato activo tienen flujo movil posible).
     */
    public function clientes(): JsonResponse
    {
        $clientes = Client::whereHas('contracts', fn ($q) => $q->where('contracts.estado', ContractStatus::ACTIVO->value))
            ->with(['contracts' => fn ($q) => $q->where('contracts.estado', ContractStatus::ACTIVO->value)->orderBy('id')])
            ->orderBy('razon_social')
            ->get(['id', 'razon_social']);

        return response()->json(
            $clientes->map(fn ($cliente) => [
                'id' => $cliente->id,
                'razon_social' => $cliente->razon_social,
                'contratos' => $cliente->contracts
                    ->map(fn ($contract) => [
                        'id' => $contract->id,
                        'codigo_negocio' => $contract->codigo_negocio,
                    ])
                    ->values()
                    ->all(),
            ])->values()->all()
        );
    }

    /**
     * Registra la entrega de un insumo (toner/consumible) durante una visita
     * ENTREGA_INSUMOS. Descontar stock es una salida de inventario, por lo que
     * la ruta vive bajo permission:inventario.articulos.
     */
    public function deliverArticle(Request $request, Visit $visit, DeliveryService $deliveryService): JsonResponse
    {
        $data = $request->validate([
            'articulo_id' => 'required|exists:articles,id',
            'cantidad' => 'required|integer|min:1',
        ]);

        $delivery = $deliveryService->deliver(
            $visit,
            (int) $data['articulo_id'],
            (int) $data['cantidad'],
            $request->user()
        );

        return response()->json(new ArticleDeliveryResource($delivery->load('article')), 201);
    }

    /**
     * Lista las entregas de insumos registradas en la visita.
     */
    public function deliveries(Request $request, Visit $visit)
    {
        $deliveries = $visit->deliveries()
            ->with('article')
            ->orderBy('id')
            ->paginate($request->per_page ?? 15);

        return ArticleDeliveryResource::collection($deliveries);
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
