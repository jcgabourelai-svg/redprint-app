<?php

namespace App\Services;

use App\Enums\VisitStatus;
use App\Models\ArticleDelivery;
use App\Models\ContractPrinter;
use App\Models\Printer;
use App\Models\Reading;
use App\Models\Visit;
use App\Support\TonerLevels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Estimados de tóner derivados de los niveles capturados en lecturas.
 * Informativo y estimativo: JAMÁS alimenta facturación ni cobro (D1 de
 * PROJECT.md). Con datos insuficientes todo devuelve null (nunca inventar)
 * y la UI lo etiqueta "estimado".
 */
class TonerService
{
    /** Subida de nivel entre lecturas consecutivas que cuenta como reset (cambio de tóner). */
    public const UMBRAL_CAMBIO = 30;

    /** Días-para-agotarse que hacen urgente una impresora en el panel. */
    public const DIAS_URGENCIA = 14;

    /** Ventana (días) del promedio diario de páginas del contrato. */
    public const VENTANA_PROMEDIO_DIAS = 90;

    /** Tolerancia (días) para correlacionar un reset con una entrega de tóner. */
    public const CORRELACION_DIAS = 7;

    public const PANEL_LIMITE = 10;

    /**
     * Páginas restantes estimadas por color: pendiente de consumo entre las
     * dos últimas lecturas con ese color. Los pares con Δcontador ≤ 0
     * (anomalía) o Δnivel ≤ 0 (sin caída, pendiente incalculable) se
     * descartan ⇒ null.
     *
     * @return array<string, int|null>
     */
    public function paginasRestantes(Printer $printer): array
    {
        return $this->paginasRestantesDesdeLecturas($this->lecturasConNivel($printer));
    }

    /**
     * Días hasta agotarse por color: páginas restantes ÷ promedio diario de
     * páginas del contrato activo (ventana 90 días; fallback toda la vida si
     * la ventana trae <2 lecturas). Sin contrato activo ⇒ null (las páginas
     * restantes sí se reportan).
     *
     * @param array<string, int|null>|null $paginasRestantes
     * @return array<string, int|null>
     */
    public function diasParaAgotarse(Printer $printer, ?array $paginasRestantes = null): array
    {
        $paginasRestantes ??= $this->paginasRestantes($printer);

        $contract = $printer->currentAssignment?->contract;

        if ($contract === null) {
            return array_fill_keys(array_keys($paginasRestantes), null);
        }

        $lecturasContrato = Reading::where('impresora_id', $printer->id)
            ->where('contrato_id', $contract->id)
            ->orderBy('fecha')
            ->orderBy('id')
            ->get();

        $dias = [];
        foreach ($paginasRestantes as $clave => $paginas) {
            $dias[$clave] = $this->calcularDias($paginas, $lecturasContrato);
        }

        return $dias;
    }

    /**
     * Resets de nivel (cambio de tóner autodetectado) con correlación a la
     * entrega de tóner más cercana ±CORRELACION_DIAS en contratos de la
     * impresora. Sin entrega ⇒ con_entrega false (señal "anomalía de
     * insumo", informativa). Orden fecha desc.
     *
     * @return array<int, array{color: string, fecha: string, nivel_antes: int, nivel_despues: int, contador: int, con_entrega: bool, entrega_fecha: string|null, entrega_articulo: string|null}>
     */
    public function cambiosDetectados(Printer $printer, int $limite = 20): array
    {
        $lecturas = $this->lecturasConNivel($printer);

        $eventos = [];
        foreach (TonerLevels::CLAVES as $clave) {
            $conColor = $this->lecturasConColor($lecturas, $clave);

            for ($i = 1, $n = $conColor->count(); $i < $n; $i++) {
                $prev = $conColor[$i - 1];
                $post = $conColor[$i];
                $subida = (int) $post->niveles_toner[$clave] - (int) $prev->niveles_toner[$clave];

                if ($subida >= self::UMBRAL_CAMBIO) {
                    $eventos[] = [
                        'color' => $clave,
                        'fecha' => $post->fecha->toDateString(),
                        'nivel_antes' => (int) $prev->niveles_toner[$clave],
                        'nivel_despues' => (int) $post->niveles_toner[$clave],
                        'contador' => (int) $post->valor_contador,
                    ];
                }
            }
        }

        if ($eventos === []) {
            return [];
        }

        usort($eventos, fn (array $a, array $b) => strcmp($b['fecha'], $a['fecha']));

        $eventos = array_slice($eventos, 0, $limite);

        $entregas = $this->entregasToner($printer);

        foreach ($eventos as &$evento) {
            $entrega = $this->entregaMasCercana($evento['fecha'], $entregas);
            $evento['con_entrega'] = $entrega !== null;
            $evento['entrega_fecha'] = $entrega?->fecha_creacion?->toDateString();
            $evento['entrega_articulo'] = $entrega?->article?->nombre;
        }

        return $eventos;
    }

    /**
     * Rendimiento real (páginas por tóner) del modelo: mediana de los tramos
     * entre resets de nivel de todas las impresoras del modelo (el primer
     * tramo empieza en la primera lectura con nivel). Con $articuloId, solo
     * tramos cuyo reset correlaciona con una entrega de ese artículo.
     * Mediana — no promedio — porque la captura a ojo genera outliers.
     */
    public function rendimientoReal(int $printerModelId, ?int $articuloId = null): ?int
    {
        $impresoras = Printer::where('printer_model_id', $printerModelId)->get();

        $tramos = [];

        foreach ($impresoras as $impresora) {
            $lecturas = $this->lecturasConNivel($impresora);

            if ($lecturas->count() < 2) {
                continue;
            }

            $entregas = $articuloId !== null
                ? $this->entregasToner($impresora)->filter(fn (ArticleDelivery $e) => $e->articulo_id === $articuloId)
                : null;

            foreach (TonerLevels::CLAVES as $clave) {
                $conColor = $this->lecturasConColor($lecturas, $clave);
                $n = $conColor->count();

                if ($n < 2) {
                    continue;
                }

                // Inicios de tramo: la primera lectura con nivel y cada rPost de reset.
                $inicios = [0];
                $resets = [];

                for ($i = 1; $i < $n; $i++) {
                    $subida = (int) $conColor[$i]->niveles_toner[$clave] - (int) $conColor[$i - 1]->niveles_toner[$clave];
                    if ($subida >= self::UMBRAL_CAMBIO) {
                        $resets[] = [$i - 1, $i];
                        $inicios[] = $i;
                    }
                }

                foreach ($inicios as $idx => $inicioIdx) {
                    // Fin del tramo: rPrev del reset siguiente (o última lectura).
                    $finIdx = $resets[$idx][0] ?? $n - 1;

                    $paginas = (int) $conColor[$finIdx]->valor_contador - (int) $conColor[$inicioIdx]->valor_contador;

                    if ($paginas <= 0) {
                        continue;
                    }

                    if ($entregas !== null) {
                        // El tramo nace en el reset previo; sin reset no hay entrega que correlacionar.
                        $resetLectura = $idx === 0 ? null : $conColor[$resets[$idx - 1][1]];
                        if ($resetLectura === null || $this->entregaMasCercana($resetLectura->fecha->toDateString(), $entregas) === null) {
                            continue;
                        }
                    }

                    $tramos[] = $paginas;
                }
            }
        }

        if ($tramos === []) {
            return null;
        }

        sort($tramos);
        $n = count($tramos);

        $mediana = $n % 2 === 1
            ? $tramos[(int) ($n / 2)]
            : ($tramos[$n / 2 - 1] + $tramos[$n / 2]) / 2;

        return (int) $mediana;
    }

    /**
     * Agregado para la API del detalle de impresora.
     */
    public function estimados(Printer $printer): array
    {
        $lecturas = $this->lecturasConNivel($printer);

        $niveles = $this->ultimosNiveles($lecturas);
        $paginas = $this->paginasRestantesDesdeLecturas($lecturas);
        $dias = $this->diasParaAgotarse($printer, $paginas);

        [$colorCritico, $nivelCritico] = $this->colorCritico($niveles);

        $porColor = [];
        foreach ($niveles as $clave => $nivel) {
            $porColor[$clave] = [
                'paginas_restantes' => $paginas[$clave],
                'dias' => $dias[$clave],
            ];
        }

        $costoToner = $this->costoTonerPorPaginaPorImpresora([$printer->id])[(string) $printer->id]
            ?? ['costo_toner_promedio' => null, 'costo_toner_por_pagina' => null];

        return [
            'niveles_actuales' => $niveles,
            'fecha_ultimo_nivel' => $lecturas->last()?->fecha?->toDateString(),
            'por_color' => $porColor,
            'color_critico' => $colorCritico,
            'nivel_critico' => $nivelCritico,
            'rendimiento_real_modelo' => $printer->printer_model_id !== null
                ? $this->rendimientoReal($printer->printer_model_id)
                : null,
            'costo_toner_promedio' => $costoToner['costo_toner_promedio'],
            'costo_toner_por_pagina' => $costoToner['costo_toner_por_pagina'],
        ];
    }

    /**
     * Costo promedio del tóner entregado y costo por página estimado, en
     * lote por impresora (reportes). Estimación de largo plazo: agrega TODAS
     * las entregas TONER de TODOS los contratos históricos de cada impresora
     * (mismo alcance que entregasToner), sin filtro de fechas.
     *
     * - costo_toner_promedio = Σ(cantidad×costo_unitario) ÷ Σ cantidad de
     *   sus contratos (promedio ponderado; entregas sin costo no pesan).
     * - costo_toner_por_pagina = costo_toner_promedio ÷ rendimientoReal del
     *   modelo (mediana de tramos entre resets; memoizado por modelo dentro
     *   de la llamada para no recargar lecturas por impresora).
     * - Sin entregas o sin rendimiento ⇒ null (nunca inventar). Estimativo,
     *   jamás alimenta facturación (D1).
     *
     * @param  array<int, int>  $impresoraIds
     * @return array<string, array{costo_toner_promedio: float|null, costo_toner_por_pagina: float|null}>
     */
    public function costoTonerPorPaginaPorImpresora(array $impresoraIds): array
    {
        $resultado = [];
        foreach ($impresoraIds as $id) {
            $resultado[(string) $id] = ['costo_toner_promedio' => null, 'costo_toner_por_pagina' => null];
        }

        if ($impresoraIds === []) {
            return $resultado;
        }

        $contratosPorImpresora = ContractPrinter::whereIn('impresora_id', $impresoraIds)
            ->get(['impresora_id', 'contrato_id'])
            ->groupBy('impresora_id');

        $contratoIds = $contratosPorImpresora->flatten(1)->pluck('contrato_id')->unique()->values();

        // Agregado por contrato: Σ cantidad y Σ(cantidad×costo). Las filas
        // sin costo_unitario se ignoran (snapshot faltante, no estimable).
        $entregasPorContrato = ArticleDelivery::query()
            ->whereIn('contrato_id', $contratoIds)
            ->whereHas('article', fn ($q) => $q->where('subtipo', 'TONER'))
            ->whereNotNull('costo_unitario')
            ->groupBy('contrato_id')
            ->selectRaw('contrato_id, SUM(cantidad) AS total_cantidad, SUM(cantidad * costo_unitario) AS total_costo')
            ->get()
            ->keyBy('contrato_id');

        $impresoras = Printer::whereIn('id', $impresoraIds)
            ->get(['id', 'printer_model_id'])
            ->keyBy('id');

        $rendimientoMemoizado = [];

        foreach ($impresoras as $impresora) {
            $key = (string) $impresora->id;
            $sumaCantidad = 0;
            $sumaCosto = 0.0;

            foreach ($contratosPorImpresora->get($impresora->id) ?? [] as $pivot) {
                $agregado = $entregasPorContrato->get($pivot->contrato_id);

                if ($agregado === null) {
                    continue;
                }

                $sumaCantidad += (int) $agregado->total_cantidad;
                $sumaCosto += (float) $agregado->total_costo;
            }

            if ($sumaCantidad <= 0) {
                continue;
            }

            $costoPromedio = $sumaCosto / $sumaCantidad;
            $resultado[$key]['costo_toner_promedio'] = (float) $costoPromedio;

            if ($impresora->printer_model_id === null) {
                continue;
            }

            if (!array_key_exists($impresora->printer_model_id, $rendimientoMemoizado)) {
                $rendimientoMemoizado[$impresora->printer_model_id] = $this->rendimientoReal($impresora->printer_model_id);
            }

            $rendimiento = $rendimientoMemoizado[$impresora->printer_model_id];

            if ($rendimiento !== null && $rendimiento > 0) {
                $resultado[$key]['costo_toner_por_pagina'] = (float) ($costoPromedio / $rendimiento);
            }
        }

        return $resultado;
    }

    /**
     * Panel "tóner bajo": impresoras RENTADA cuyo último nivel capturado
     * tenga mínimo ≤ TonerAlertService::UMBRAL o días-para-agotarse ≤
     * DIAS_URGENCIA (según el color crítico), cruzadas con la próxima
     * visita del contrato. Orden: días asc (nulls al final), luego nivel
     * asc. Queries en lote (flota, lecturas, volumen por contrato y
     * visitas), no N+1 por método.
     *
     * @return array<int, array<string, mixed>>
     */
    public function panelBajo(): array
    {
        $impresoras = Printer::rentada()
            ->with('currentAssignment.contract.client:id,razon_social')
            ->get();

        if ($impresoras->isEmpty()) {
            return [];
        }

        $lecturasPorImpresora = $this->lecturasConNivelPorImpresora($impresoras->pluck('id')->all());

        $estados = [];

        foreach ($impresoras as $impresora) {
            $lecturas = $lecturasPorImpresora->get($impresora->id);

            if ($lecturas === null) {
                continue;
            }

            $niveles = $this->ultimosNiveles($lecturas);

            if ($niveles === []) {
                continue;
            }

            [$colorCritico, $nivelCritico] = $this->colorCritico($niveles);
            $paginas = $this->paginasRestantesDesdeLecturas($lecturas);

            $estados[$impresora->id] = [
                'impresora' => $impresora,
                'niveles' => $niveles,
                'color_critico' => $colorCritico,
                'nivel_critico' => $nivelCritico,
                'paginas_critico' => $paginas[$colorCritico],
                'dias_critico' => null,
                'fecha_ultimo_nivel' => $lecturas->last()->fecha->toDateString(),
            ];
        }

        if ($estados === []) {
            return [];
        }

        // Promedio diario del contrato solo para quienes tienen páginas del
        // color crítico y contrato activo (una sola query en lote).
        $conPaginas = array_filter($estados, fn (array $e) => $e['paginas_critico'] !== null
            && $e['impresora']->currentAssignment?->contract !== null);

        if ($conPaginas !== []) {
            $contratoIds = array_unique(array_map(
                fn (array $e) => $e['impresora']->currentAssignment->contract->id,
                $conPaginas
            ));

            $lecturasContratoPorImpresora = Reading::whereIn('contrato_id', $contratoIds)
                ->whereIn('impresora_id', array_keys($conPaginas))
                ->orderBy('fecha')
                ->orderBy('id')
                ->get(['impresora_id', 'contrato_id', 'fecha', 'paginas_periodo'])
                ->groupBy('impresora_id');

            foreach ($conPaginas as $id => $estado) {
                $contratoId = $estado['impresora']->currentAssignment->contract->id;
                $lecturasContrato = ($lecturasContratoPorImpresora->get($id) ?? collect())
                    ->filter(fn (Reading $l) => $l->contrato_id === $contratoId)
                    ->values();

                $estados[$id]['dias_critico'] = $this->calcularDias($estado['paginas_critico'], $lecturasContrato);
            }
        }

        $items = [];

        foreach ($estados as $estado) {
            $incluye = $estado['nivel_critico'] <= TonerAlertService::UMBRAL
                || ($estado['dias_critico'] !== null && $estado['dias_critico'] <= self::DIAS_URGENCIA);

            if (!$incluye) {
                continue;
            }

            $impresora = $estado['impresora'];
            $assignment = $impresora->currentAssignment;
            $contract = $assignment?->contract;

            $items[] = [
                'impresora_id' => $impresora->id,
                'codigo_negocio' => $impresora->codigo_negocio,
                'marca' => $impresora->marca,
                'modelo' => $impresora->modelo,
                'alias' => $assignment->alias ?? null,
                'cliente_id' => $contract->cliente_id ?? null,
                'cliente_nombre' => $contract?->client?->razon_social,
                'contrato_id' => $contract->id ?? null,
                'niveles' => $estado['niveles'],
                'color_critico' => $estado['color_critico'],
                'nivel_critico' => $estado['nivel_critico'],
                'paginas_restantes' => $estado['paginas_critico'],
                'dias_para_agotarse' => $estado['dias_critico'],
                'proxima_visita_fecha' => null,
                'proxima_visita_socio_nombre' => null,
                'urgente_antes_de_visita' => null,
                'fecha_ultimo_nivel' => $estado['fecha_ultimo_nivel'],
            ];
        }

        if ($items === []) {
            return [];
        }

        // Próxima visita abierta por contrato (una sola query para todo el panel).
        $contratoIdsItems = array_values(array_filter(array_column($items, 'contrato_id')));

        $visitasPorContrato = Visit::whereIn('contrato_id', $contratoIdsItems)
            ->whereIn('estado', [VisitStatus::PENDIENTE, VisitStatus::REPROGRAMADA])
            ->where('fecha_programada', '>=', today())
            ->with('socio:id,nombre')
            ->orderBy('fecha_programada')
            ->get(['id', 'contrato_id', 'fecha_programada', 'socio_id'])
            ->groupBy('contrato_id');

        foreach ($items as &$item) {
            $visita = $visitasPorContrato->get($item['contrato_id'])?->first();

            if ($visita === null) {
                continue;
            }

            $item['proxima_visita_fecha'] = $visita->fecha_programada->toDateString();
            $item['proxima_visita_socio_nombre'] = $visita->socio?->nombre;
            $diasHastaVisita = (int) abs($visita->fecha_programada->diffInDays(today()));
            $item['urgente_antes_de_visita'] = $item['dias_para_agotarse'] !== null
                && $item['dias_para_agotarse'] < $diasHastaVisita;
        }
        unset($item);

        usort($items, function (array $a, array $b): int {
            $da = $a['dias_para_agotarse'];
            $db = $b['dias_para_agotarse'];

            if ($da !== $db) {
                if ($da === null) {
                    return 1;
                }
                if ($db === null) {
                    return -1;
                }

                return $da <=> $db;
            }

            return $a['nivel_critico'] <=> $b['nivel_critico'];
        });

        return array_slice($items, 0, self::PANEL_LIMITE);
    }

    // ---------------------------------------------------------------
    // Helpers privados (compartidos por todos los métodos públicos)
    // ---------------------------------------------------------------

    /** Lecturas de la impresora con algún nivel capturado, orden anti-duplicado fecha+id. */
    private function lecturasConNivel(Printer $printer): Collection
    {
        return $this->lecturasConNivelPorImpresora([$printer->id])->get($printer->id) ?? collect();
    }

    /**
     * @param array<int, int> $impresoraIds
     * @return Collection<int, Collection<int, Reading>>
     */
    private function lecturasConNivelPorImpresora(array $impresoraIds): Collection
    {
        if ($impresoraIds === []) {
            return collect();
        }

        return Reading::whereNotNull('niveles_toner')
            ->whereIn('impresora_id', $impresoraIds)
            ->orderBy('fecha')
            ->orderBy('id')
            ->get()
            ->groupBy('impresora_id');
    }

    /** @return Collection<int, Reading> */
    private function lecturasConColor(Collection $lecturas, string $clave): Collection
    {
        return $lecturas
            ->filter(fn (Reading $l) => ($l->niveles_toner[$clave] ?? null) !== null)
            ->values();
    }

    /**
     * Último nivel capturado por color (la última lectura no siempre trae
     * todos los colores).
     *
     * @return array<string, int>
     */
    private function ultimosNiveles(Collection $lecturas): array
    {
        $niveles = [];

        foreach ($lecturas as $lectura) {
            foreach (TonerLevels::CLAVES as $clave) {
                $valor = $lectura->niveles_toner[$clave] ?? null;
                if ($valor !== null) {
                    $niveles[$clave] = (int) $valor;
                }
            }
        }

        return $niveles;
    }

    /**
     * @param Collection<int, Reading> $lecturas
     * @return array<string, int|null>
     */
    private function paginasRestantesDesdeLecturas(Collection $lecturas): array
    {
        $resultado = [];

        foreach (TonerLevels::CLAVES as $clave) {
            $conColor = $this->lecturasConColor($lecturas, $clave);
            $resultado[$clave] = null;

            if ($conColor->count() < 2) {
                continue;
            }

            $prev = $conColor[$conColor->count() - 2];
            $last = $conColor[$conColor->count() - 1];

            $deltaPaginas = (int) $last->valor_contador - (int) $prev->valor_contador;
            $deltaNivel = (int) $prev->niveles_toner[$clave] - (int) $last->niveles_toner[$clave];

            if ($deltaPaginas <= 0 || $deltaNivel <= 0) {
                continue;
            }

            // Multiplicar antes de dividir mantiene la aritmética exacta en
            // los casos divisibles (evita floor(1999.999…) por redondeo float).
            $resultado[$clave] = (int) floor(((int) $last->niveles_toner[$clave] * $deltaPaginas) / $deltaNivel);
        }

        return $resultado;
    }

    /**
     * @param Collection<int, Reading> $lecturasContrato
     */
    private function calcularDias(?int $paginasRestantes, Collection $lecturasContrato): ?int
    {
        if ($paginasRestantes === null) {
            return null;
        }

        $ventana = $lecturasContrato
            ->filter(fn (Reading $l) => $l->fecha->gte(today()->subDays(self::VENTANA_PROMEDIO_DIAS)))
            ->values();

        // Ventana corta ⇒ toda la vida del contrato (si alcanza).
        $rango = $ventana->count() >= 2
            ? $ventana
            : ($lecturasContrato->count() >= 2 ? $lecturasContrato->values() : null);

        if ($rango === null) {
            return null;
        }

        // Carbon devuelve diferencias con signo: interesa la magnitud.
        $diasRango = max(1, (int) abs($rango->last()->fecha->diffInDays($rango->first()->fecha)));
        $totalPaginas = (int) $rango->sum('paginas_periodo');

        if ($totalPaginas <= 0) {
            return null;
        }

        // floor(páginas ÷ (total ÷ días)) reescrito como páginas×días ÷ total
        // para mantener la aritmética exacta en los casos divisibles.
        return (int) floor(($paginasRestantes * $diasRango) / $totalPaginas);
    }

    /**
     * Color de menor nivel capturado (ante empate gana el orden k/c/m/y:
     * la flota es mayormente mono y K manda).
     *
     * @param array<string, int> $niveles
     * @return array{0: string|null, 1: int|null}
     */
    private function colorCritico(array $niveles): array
    {
        $color = null;
        $nivel = null;

        foreach (TonerLevels::CLAVES as $clave) {
            if (isset($niveles[$clave]) && ($nivel === null || $niveles[$clave] < $nivel)) {
                $color = $clave;
                $nivel = $niveles[$clave];
            }
        }

        return [$color, $nivel];
    }

    /**
     * Entregas de tóner (subtipo TONER) de todos los contratos de la
     * impresora. `article_deliveries` no tiene impresora_id: la correlación
     * es por contrato (limitación conocida y aceptada).
     *
     * @return Collection<int, ArticleDelivery>
     */
    private function entregasToner(Printer $printer): Collection
    {
        $contratoIds = $printer->assignments()->pluck('contrato_id');

        if ($contratoIds->isEmpty()) {
            return collect();
        }

        return ArticleDelivery::with('article:id,nombre,subtipo')
            ->whereIn('contrato_id', $contratoIds)
            ->whereHas('article', fn ($q) => $q->where('subtipo', 'TONER'))
            ->whereNotNull('fecha_creacion')
            ->get();
    }

    /** @param Collection<int, ArticleDelivery> $entregas */
    private function entregaMasCercana(string $fecha, Collection $entregas): ?ArticleDelivery
    {
        $fecha = Carbon::parse($fecha);
        $mejor = null;
        $mejorDiff = null;

        foreach ($entregas as $entrega) {
            $diff = abs($entrega->fecha_creacion->diffInDays($fecha));

            if ($diff <= self::CORRELACION_DIAS && ($mejorDiff === null || $diff < $mejorDiff)) {
                $mejor = $entrega;
                $mejorDiff = $diff;
            }
        }

        return $mejor;
    }
}
