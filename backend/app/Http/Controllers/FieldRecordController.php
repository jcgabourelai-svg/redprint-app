<?php

namespace App\Http\Controllers;

use App\Enums\FieldRecordType;
use App\Http\Requests\StoreFieldRecordRequest;
use App\Http\Resources\FieldRecordResource;
use App\Models\FieldRecord;
use App\Services\FieldRecordService;
use App\Traits\Sortable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FieldRecordController extends Controller
{
    use Sortable;

    public function __construct(
        private FieldRecordService $fieldRecordService
    ) {}

    public function index(Request $request)
    {
        $query = FieldRecord::with(['socio', 'client', 'contract', 'printer'])
            ->when($request->estado, fn($q, $e) => $q->where('estado', $e))
            ->when($request->tipo, fn($q, $t) => $q->where('tipo', $t))
            ->when($request->socio_id, fn($q, $id) => $q->where('socio_id', $id))
            ->when($request->search, function ($q, $s) {
                $q->where(function ($q2) use ($s) {
                    $q2->where('nombre_cliente_reportado', 'ilike', "%{$s}%")
                        ->orWhere('num_serie_reportado', 'ilike', "%{$s}%");
                });
            });

        $this->applySorting($query, $request, [
            'id', 'capturado_en', 'estado', 'created_at',
        ], 'capturado_en', 'desc');

        $records = $query->paginate($request->per_page ?? 15);

        return FieldRecordResource::collection($records);
    }

    public function show(FieldRecord $fieldRecord): FieldRecordResource
    {
        $fieldRecord->load(['socio', 'client', 'contract', 'printer', 'visit', 'reading', 'vinculadoPor']);

        return new FieldRecordResource($fieldRecord);
    }

    public function store(StoreFieldRecordRequest $request, FieldRecordService $service): JsonResponse
    {
        $record = $service->create($request->validated(), $request->user());

        // Dedup por client_uuid: si ya existia, se devuelve tal cual (200, no 201)
        $status = $record->wasRecentlyCreated ? 201 : 200;

        return response()->json(new FieldRecordResource($record->load(['socio'])), $status);
    }

    /**
     * Regulariza un registro PENDIENTE: crea la visita CAMPO (+ lectura,
     * entregas o instalacion implicita) en una sola transaccion.
     */
    public function link(Request $request, FieldRecord $fieldRecord, FieldRecordService $service): FieldRecordResource
    {
        $rules = [
            'cliente_id' => 'required|exists:clients,id',
            'contrato_id' => 'required|exists:contracts,id',
            'impresora_id' => 'nullable|exists:printers,id',
            'justificacion_anomalia' => 'nullable|string|max:1000',
            'articulos' => 'nullable|array',
            'articulos.*.articulo_id' => 'required_with:articulos|exists:articles,id',
            'articulos.*.cantidad' => 'required_with:articulos|integer|min:1',
            'tipo_visita' => 'nullable|in:LECTURA,MANTENIMIENTO,INSTALACION,RETIRO,ENTREGA_INSUMOS',
            'motivo_cierre' => 'nullable|string|max:1000',
        ];

        if ($fieldRecord->tipo === FieldRecordType::LECTURA) {
            $rules['impresora_id'] = 'required|exists:printers,id';
        }

        if ($fieldRecord->tipo === FieldRecordType::OTRO) {
            $rules['tipo_visita'] = 'required|in:LECTURA,MANTENIMIENTO,INSTALACION,RETIRO,ENTREGA_INSUMOS';
            $rules['motivo_cierre'] = 'required|string|max:1000';
        }

        $data = $request->validate($rules, [
            'cliente_id.required' => 'El cliente es obligatorio',
            'contrato_id.required' => 'El contrato es obligatorio',
            'impresora_id.required' => 'La impresora es obligatoria para registros de lectura',
            'tipo_visita.required' => 'El tipo de visita es obligatorio para registros genéricos',
            'motivo_cierre.required' => 'El motivo de cierre es obligatorio para registros genéricos',
        ]);

        $record = $service->link($fieldRecord, $data, $request->user());

        return new FieldRecordResource($record);
    }

    /**
     * Descarta un registro PENDIENTE con motivo obligatorio. No revierte nada:
     * un registro descartado nunca generó movimientos.
     */
    public function discard(Request $request, FieldRecord $fieldRecord, FieldRecordService $service): FieldRecordResource
    {
        $data = $request->validate([
            'motivo_descarte' => 'required|string|max:1000',
        ], [
            'motivo_descarte.required' => 'El motivo de descarte es obligatorio',
        ]);

        $record = $service->discard($fieldRecord, $data['motivo_descarte'], $request->user());

        return new FieldRecordResource($record);
    }
}
