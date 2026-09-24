<?php

namespace App\Http\Controllers;

use App\Enums\ArticleType;
use App\Enums\MaintenanceStatus;
use App\Enums\PrinterCondition;
use App\Enums\PrinterStatus;
use App\Models\Article;
use App\Models\MaintenanceOrder;
use App\Models\Printer;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

/**
 * Dashboard del taller (F3): vista operativa del estado técnico de la flota.
 * Reusa el permiso inventario.mantenimiento (decisión §6.5) y se cachea 5
 * minutos como el dashboard general.
 */
class TallerController extends Controller
{
    public function __construct(
        private ReportService $reportService
    ) {}

    public function dashboard(): JsonResponse
    {
        $data = Cache::remember(
            'taller.dashboard',
            now()->addMinutes(5),
            fn () => $this->build(),
        );

        return response()->json($data);
    }

    private function build(): array
    {
        $flotaActiva = fn () => Printer::where('estado', '!=', PrinterStatus::DADA_DE_BAJA);

        // KPIs por condición técnica + estados operativos.
        $porCondicion = $flotaActiva()
            ->select('condicion')
            ->selectRaw('COUNT(*) as total')
            ->groupBy('condicion')
            ->get()
            ->mapWithKeys(fn ($row) => [$row->condicion?->value ?? 'sin_condicion' => (int) $row->total]);

        $disponiblesRenta = Printer::enAlmacen()
            ->where(fn ($q) => $q->whereNull('condicion')->orWhere('condicion', PrinterCondition::OPERATIVA))
            ->whereDoesntHave('openMaintenanceOrder')
            ->count();

        $kpis = [
            'no_operativas' => (int) ($porCondicion['NO_OPERATIVA'] ?? 0),
            'requiere_atencion' => (int) ($porCondicion['REQUIERE_ATENCION'] ?? 0),
            'en_taller' => (int) $flotaActiva()->where('estado', PrinterStatus::EN_MANTENIMIENTO)->count(),
            'disponibles_renta' => $disponiblesRenta,
            'para_piezas' => (int) ($porCondicion['PIEZAS'] ?? 0),
            'sin_condicion' => (int) ($porCondicion['sin_condicion'] ?? 0),
        ];

        // Cola del taller: severidad descendente (CRITICA→BAJA, null al
        // final), luego antigüedad; el trabajo más urgente y viejo arriba.
        $cola = MaintenanceOrder::programada()
            ->with([
                'printer:id,marca,modelo,codigo_negocio,almacen_id',
                'printer.warehouse:id,nombre',
                'printer.currentAssignment.contract:id,client_id,codigo_negocio',
                'printer.currentAssignment.contract.client:id,razon_social',
            ])
            ->select('id', 'impresora_id', 'severidad', 'tipo_mantto', 'desc_problema', 'fecha', 'fecha_creacion')
            ->orderByRaw("CASE severidad WHEN 'CRITICA' THEN 1 WHEN 'ALTA' THEN 2 WHEN 'MEDIA' THEN 3 WHEN 'BAJA' THEN 4 ELSE 5 END")
            ->orderBy('fecha_creacion')
            ->orderBy('id')
            ->limit(20)
            ->get()
            ->map(fn ($order) => [
                'orden_id' => $order->id,
                'severidad' => $order->severidad?->value,
                'tipo_mantto' => $order->tipo_mantto?->value,
                'desc_problema' => $order->desc_problema,
                'dias_desde_creacion' => (int) $order->fecha_creacion->diffInDays(now()),
                'fecha_creacion' => $order->fecha_creacion?->toIso8601String(),
                'fecha' => $order->fecha?->toDateString(),
                'impresora' => $order->printer === null ? null : [
                    'id' => $order->printer->id,
                    'marca' => $order->printer->marca,
                    'modelo' => $order->printer->modelo,
                    'codigo' => $order->printer->codigo_negocio,
                ],
                'ubicacion' => $this->ubicacionDeImpresora($order->printer),
            ])
            ->values()
            ->toArray();

        // No operativas sin orden PROGRAMADA: prompt para crearla.
        $sinOrden = Printer::where('condicion', PrinterCondition::NO_OPERATIVA)
            ->where('estado', '!=', PrinterStatus::DADA_DE_BAJA)
            ->whereDoesntHave('openMaintenanceOrder')
            ->orderBy('id')
            ->get(['id', 'marca', 'modelo', 'codigo_negocio'])
            ->map(fn ($printer) => [
                'id' => $printer->id,
                'marca' => $printer->marca,
                'modelo' => $printer->modelo,
                'codigo' => $printer->codigo_negocio,
            ])
            ->values()
            ->toArray();

        // Matriz estado comercial × condición técnica.
        $matrizFilas = $flotaActiva()
            ->select('estado', 'condicion')
            ->selectRaw('COUNT(*) as total')
            ->groupBy('estado', 'condicion')
            ->get();

        $condicionesColumna = [
            'OPERATIVA',
            'REQUIERE_ATENCION',
            'NO_OPERATIVA',
            'PIEZAS',
            'sin_condicion',
        ];

        $matriz = [];
        foreach ([PrinterStatus::EN_ALMACEN, PrinterStatus::RENTADA, PrinterStatus::EN_MANTENIMIENTO] as $estado) {
            $fila = ['estado' => $estado->value];
            foreach ($condicionesColumna as $condicion) {
                $fila[$condicion] = 0;
            }

            $fila['total'] = 0;
            $matriz[$estado->value] = $fila;
        }

        foreach ($matrizFilas as $celda) {
            $clave = $celda->condicion?->value ?? 'sin_condicion';
            $estado = $celda->estado->value;

            if (!isset($matriz[$estado])) {
                continue;
            }

            $matriz[$estado][$clave] = (int) $celda->total;
            $matriz[$estado]['total'] += (int) $celda->total;
        }

        // Piezas de reparación en o bajo umbral (misma señal que reorden).
        $piezasBajoUmbral = Article::where('tipo_articulo', ArticleType::REPARACION)
            ->where('activo', true)
            ->whereColumn('stock_actual', '<=', 'umbral_reposicion')
            ->orderBy('stock_actual')
            ->get(['id', 'nombre', 'stock_actual', 'umbral_reposicion'])
            ->map(fn ($article) => [
                'id' => $article->id,
                'nombre' => $article->nombre,
                'stock_actual' => (int) $article->stock_actual,
                'stock_minimo' => (int) $article->umbral_reposicion,
            ])
            ->values()
            ->toArray();

        return [
            'kpis' => $kpis,
            'cola' => $cola,
            'sin_orden' => $sinOrden,
            'matriz_estado_condicion' => array_values($matriz),
            'piezas_bajo_umbral' => $piezasBajoUmbral,
            'productividad_mes' => $this->reportService->getMaintenanceStats([]),
        ];
    }

    /**
     * Ubicación física derivada de la impresora: asignación activa ⇒ piso
     * del cliente; sin asignación ⇒ taller/almacén.
     */
    private function ubicacionDeImpresora(?Printer $printer): ?array
    {
        if ($printer === null) {
            return null;
        }

        $contrato = $printer->currentAssignment?->contract;

        if ($contrato !== null) {
            return [
                'lugar' => 'PISO',
                'cliente' => $contrato->client?->razon_social,
                'contrato' => $contrato->codigo_negocio,
            ];
        }

        return [
            'lugar' => 'TALLER',
            'almacen' => $printer->warehouse?->nombre,
        ];
    }
}
