<?php

namespace Tests\Feature;

use App\Enums\ContractStatus;
use App\Enums\PrinterStatus;
use App\Enums\VisitStatus;
use App\Models\Article;
use App\Models\ArticleDelivery;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Printer;
use App\Models\PrinterBrand;
use App\Models\PrinterModel;
use App\Models\Reading;
use App\Models\Role;
use App\Models\User;
use App\Models\Visit;
use App\Services\TonerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TonerServiceTest extends TestCase
{
    use RefreshDatabase;

    private TonerService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(TonerService::class);
    }

    private function adminUser(): User
    {
        $role = Role::create([
            'nombre' => 'Admin Test',
            'slug' => 'admin-test-' . uniqid(),
            'es_sistema' => true,
        ]);

        return User::create([
            'nombre' => 'Admin Test',
            'correo' => 'admin-' . uniqid() . '@test.com',
            'contrasena_hash' => 'password',
            'telefono' => '555-0100',
            'rol_id' => $role->id,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);
    }

    private function setupContractWithPrinter(User $admin, int $lecturaInicial): array
    {
        $client = Client::create([
            'razon_social' => 'Cliente ' . uniqid(),
            'rfc' => strtoupper(substr(md5(uniqid()), 0, 10)),
            'nombre_contacto' => 'Contacto',
            'telefono' => '555-0200',
            'correo' => 'cliente@test.com',
            'direccion_instalacion' => 'Calle Falsa 123',
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

        $brand = PrinterBrand::firstOrCreate(['slug' => 'hp'], ['nombre' => 'HP']);
        $model = PrinterModel::firstOrCreate(
            ['brand_id' => $brand->id, 'nombre' => 'LaserJet Pro M404 ' . uniqid()]
        );

        $printer = Printer::create([
            'marca' => 'HP',
            'modelo' => 'LaserJet Pro M404',
            'printer_model_id' => $model->id,
            'num_serie' => 'SN-' . uniqid(),
            'fecha_adquisicion' => today(),
            'codigo_negocio' => 'EQ-' . uniqid(),
            'estado' => PrinterStatus::RENTADA,
            'contador_actual' => $lecturaInicial,
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

        $contract = Contract::create([
            'cliente_id' => $client->id,
            'codigo_negocio' => 'CTR-' . uniqid(),
            'fecha_inicio' => today()->subDays(30),
            'tarifa_base' => 1000,
            'paginas_incluidas' => 0,
            'costo_pag_excedente' => 0.01,
            'dias_gracia' => 15,
            'frecuencia_visitas' => 'MENSUAL',
            'dias_adelanto' => 7,
            'estado' => ContractStatus::ACTIVO,
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

        $contract->printers()->attach($printer->id, [
            'fecha_asignacion' => today()->subDays(30),
            'lectura_inicial' => $lecturaInicial,
            'activa' => true,
        ]);

        return [$contract, $printer];
    }

    private function lectura(User $socio, ?Contract $contract, Printer $printer, string $fecha, int $contador, ?array $niveles = null, ?int $paginas = null, ?Client $cliente = null): Reading
    {
        $visita = Visit::create([
            'cliente_id' => $contract?->cliente_id ?? $cliente?->id,
            'contrato_id' => $contract?->id,
            'tipo_visita' => 'LECTURA',
            'fecha_programada' => $fecha,
            'socio_id' => $socio->id,
            'estado' => VisitStatus::PENDIENTE,
            'creado_por' => $socio->id,
            'fecha_creacion' => now(),
        ]);

        return Reading::create([
            'visita_id' => $visita->id,
            'impresora_id' => $printer->id,
            'contrato_id' => $contract?->id,
            'fecha' => $fecha,
            'valor_contador' => $contador,
            'paginas_periodo' => $paginas ?? 0,
            'niveles_toner' => $niveles,
            'socio_id' => $socio->id,
            'creado_por' => $socio->id,
            'fecha_creacion' => now(),
        ]);
    }

    private function toner(): Article
    {
        return Article::create([
            'tipo_articulo' => 'CONSUMIBLE',
            'subtipo' => 'TONER',
            'nombre' => 'Toner HP 26A Negro',
            'marca' => 'HP',
            'modelo_sku' => 'CF226A-' . uniqid(),
            'stock_actual' => 10,
            'umbral_reposicion' => 3,
            'costo_unitario' => 1850,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);
    }

    private function entrega(User $socio, Contract $contract, Article $articulo, int $cantidad, float $costoUnitario): ArticleDelivery
    {
        $visita = Visit::create([
            'cliente_id' => $contract->cliente_id,
            'contrato_id' => $contract->id,
            'tipo_visita' => 'ENTREGA_INSUMOS',
            'fecha_programada' => today()->toDateString(),
            'socio_id' => $socio->id,
            'estado' => VisitStatus::COMPLETADA,
            'creado_por' => $socio->id,
            'fecha_creacion' => now(),
        ]);

        return ArticleDelivery::create([
            'articulo_id' => $articulo->id,
            'visita_id' => $visita->id,
            'contrato_id' => $contract->id,
            'cliente_id' => $contract->cliente_id,
            'cantidad' => $cantidad,
            'costo_unitario' => $costoUnitario,
            'subtotal' => $cantidad * $costoUnitario,
            'socio_id' => $socio->id,
            'fecha_creacion' => today()->setTime(12, 0),
        ]);
    }

    public function test_paginas_restantes_null_con_menos_de_dos_lecturas_con_nivel(): void
    {
        $admin = $this->adminUser();
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 1000);

        $vacio = ['k' => null, 'c' => null, 'm' => null, 'y' => null];

        $this->assertSame($vacio, $this->service->paginasRestantes($printer));

        $this->lectura($admin, $contract, $printer, today()->toDateString(), 1200, ['k' => 80]);

        $this->assertSame($vacio, $this->service->paginasRestantes($printer));
    }

    public function test_paginas_restantes_por_pendiente_entre_dos_lecturas(): void
    {
        $admin = $this->adminUser();
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 10000);

        // 80%@10.000 → 60%@10.500: Δ50 págs/% ⇒ 60% ≈ 1.500 págs.
        $this->lectura($admin, $contract, $printer, today()->subDays(15)->toDateString(), 10000, ['k' => 80]);
        $this->lectura($admin, $contract, $printer, today()->toDateString(), 10500, ['k' => 60]);

        $this->assertSame(1500, $this->service->paginasRestantes($printer)['k']);
    }

    public function test_paginas_restantes_descarta_pares_sin_caida_de_nivel_o_contador_anomalo(): void
    {
        $admin = $this->adminUser();

        // Nivel plano (80 → 80): sin caída, pendiente incalculable.
        [$contractA, $printerA] = $this->setupContractWithPrinter($admin, 10000);
        $this->lectura($admin, $contractA, $printerA, today()->subDays(15)->toDateString(), 10000, ['k' => 80]);
        $this->lectura($admin, $contractA, $printerA, today()->toDateString(), 10500, ['k' => 80]);
        $this->assertNull($this->service->paginasRestantes($printerA)['k']);

        // Contador que baja (anomalía): par descartado.
        [$contractB, $printerB] = $this->setupContractWithPrinter($admin, 10500);
        $this->lectura($admin, $contractB, $printerB, today()->subDays(15)->toDateString(), 10500, ['k' => 80]);
        $this->lectura($admin, $contractB, $printerB, today()->toDateString(), 10400, ['k' => 60]);
        $this->assertNull($this->service->paginasRestantes($printerB)['k']);
    }

    public function test_color_parcial_solo_k_estimable(): void
    {
        $admin = $this->adminUser();
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 10000);

        $this->lectura($admin, $contract, $printer, today()->subDays(15)->toDateString(), 10000, ['k' => 90]);
        $this->lectura($admin, $contract, $printer, today()->toDateString(), 10500, ['k' => 70]);

        $estimados = $this->service->estimados($printer);

        // C/M/Y nunca se capturaron: no aparecen (nada de nulls ruidosos).
        $this->assertSame(['k'], array_keys($estimados['por_color']));
        $this->assertSame(1750, $estimados['por_color']['k']['paginas_restantes']);
        $this->assertSame('k', $estimados['color_critico']);
        $this->assertSame(70, $estimados['nivel_critico']);
        $this->assertSame(['k' => 70], $estimados['niveles_actuales']);
        $this->assertSame(today()->toDateString(), $estimados['fecha_ultimo_nivel']);
    }

    public function test_dias_para_agotarse_con_promedio_del_contrato(): void
    {
        $admin = $this->adminUser();
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 10000);

        // 100%@10.000 → 60%@13.000 (Δ40 pts, 3.000 págs) ⇒ 4.500 págs
        // restantes; 3.000 págs en 10 días ⇒ 300/día ⇒ 15 días.
        $this->lectura($admin, $contract, $printer, today()->subDays(10)->toDateString(), 10000, ['k' => 100], 0);
        $this->lectura($admin, $contract, $printer, today()->toDateString(), 13000, ['k' => 60], 3000);

        $paginas = $this->service->paginasRestantes($printer);
        $this->assertSame(4500, $paginas['k']);

        $dias = $this->service->diasParaAgotarse($printer, $paginas);
        $this->assertSame(15, $dias['k']);
    }

    public function test_dias_para_agotarse_null_sin_contrato_activo(): void
    {
        $admin = $this->adminUser();

        // Impresora sin asignación: las páginas se reportan, los días no.
        $brand = PrinterBrand::firstOrCreate(['slug' => 'hp'], ['nombre' => 'HP']);
        $model = PrinterModel::firstOrCreate(['brand_id' => $brand->id, 'nombre' => 'LaserJet libre ' . uniqid()]);

        $printer = Printer::create([
            'marca' => 'HP',
            'modelo' => 'LaserJet libre',
            'printer_model_id' => $model->id,
            'num_serie' => 'SN-' . uniqid(),
            'fecha_adquisicion' => today(),
            'codigo_negocio' => 'EQ-' . uniqid(),
            'estado' => PrinterStatus::EN_ALMACEN,
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

        $clienteLibre = Client::create([
            'razon_social' => 'Cliente Libre ' . uniqid(),
            'rfc' => strtoupper(substr(md5(uniqid()), 0, 10)),
            'nombre_contacto' => 'Contacto',
            'telefono' => '555-0200',
            'correo' => 'cliente@test.com',
            'direccion_instalacion' => 'Calle Falsa 123',
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

        $this->lectura($admin, null, $printer, today()->subDays(15)->toDateString(), 10000, ['k' => 80], cliente: $clienteLibre);
        $this->lectura($admin, null, $printer, today()->toDateString(), 10500, ['k' => 60], cliente: $clienteLibre);

        $paginas = $this->service->paginasRestantes($printer);
        $this->assertSame(1500, $paginas['k']);

        $dias = $this->service->diasParaAgotarse($printer, $paginas);
        $this->assertNull($dias['k']);
    }

    public function test_dias_para_agotarse_null_con_promedio_diario_cero(): void
    {
        $admin = $this->adminUser();
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 10000);

        $this->lectura($admin, $contract, $printer, today()->subDays(30)->toDateString(), 10000, ['k' => 80], 0);
        $this->lectura($admin, $contract, $printer, today()->toDateString(), 13000, ['k' => 60], 0);

        $dias = $this->service->diasParaAgotarse($printer);
        $this->assertNull($dias['k']);
    }

    public function test_cambios_detectados_umbral_y_orden(): void
    {
        $admin = $this->adminUser();
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 1000);

        // 30→35 NO es evento; 8→100 sí (reset).
        $this->lectura($admin, $contract, $printer, today()->subDays(9)->toDateString(), 1000, ['k' => 30]);
        $this->lectura($admin, $contract, $printer, today()->subDays(8)->toDateString(), 1100, ['k' => 35]);
        $this->lectura($admin, $contract, $printer, today()->subDays(3)->toDateString(), 1200, ['k' => 8]);
        $this->lectura($admin, $contract, $printer, today()->subDays(2)->toDateString(), 1300, ['k' => 100]);

        $cambios = $this->service->cambiosDetectados($printer);

        $this->assertCount(1, $cambios);
        $this->assertSame('k', $cambios[0]['color']);
        $this->assertSame(8, $cambios[0]['nivel_antes']);
        $this->assertSame(100, $cambios[0]['nivel_despues']);
        $this->assertSame(1300, $cambios[0]['contador']);
        $this->assertSame(today()->subDays(2)->toDateString(), $cambios[0]['fecha']);
        $this->assertFalse($cambios[0]['con_entrega']);
    }

    public function test_cambio_correlacionado_con_entrega_de_toner(): void
    {
        $admin = $this->adminUser();
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 1000);

        $this->lectura($admin, $contract, $printer, today()->subDays(3)->toDateString(), 1200, ['k' => 8]);
        $this->lectura($admin, $contract, $printer, today()->subDays(2)->toDateString(), 1300, ['k' => 100]);

        $articulo = Article::create([
            'tipo_articulo' => 'CONSUMIBLE',
            'subtipo' => 'TONER',
            'nombre' => 'Toner HP 26A Negro',
            'marca' => 'HP',
            'modelo_sku' => 'CF226A',
            'stock_actual' => 10,
            'umbral_reposicion' => 3,
            'costo_unitario' => 1850,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);

        $visitaEntrega = Visit::create([
            'cliente_id' => $contract->cliente_id,
            'contrato_id' => $contract->id,
            'tipo_visita' => 'LECTURA',
            'fecha_programada' => today()->subDays(2)->toDateString(),
            'socio_id' => $admin->id,
            'estado' => VisitStatus::COMPLETADA,
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

        ArticleDelivery::create([
            'articulo_id' => $articulo->id,
            'visita_id' => $visitaEntrega->id,
            'contrato_id' => $contract->id,
            'cliente_id' => $contract->cliente_id,
            'cantidad' => 1,
            'costo_unitario' => 1850,
            'subtotal' => 1850,
            'socio_id' => $admin->id,
            'fecha_creacion' => today()->subDays(2)->setTime(12, 0),
        ]);

        $cambios = $this->service->cambiosDetectados($printer);

        $this->assertTrue($cambios[0]['con_entrega']);
        $this->assertSame('Toner HP 26A Negro', $cambios[0]['entrega_articulo']);
        $this->assertSame(today()->subDays(2)->toDateString(), $cambios[0]['entrega_fecha']);
    }

    public function test_rendimiento_real_mediana_de_tramos(): void
    {
        $admin = $this->adminUser();

        // Dos tramos limpios: 2.900 y 3.000 ⇒ mediana 2.950.
        // (setupContractWithPrinter crea un modelo único por impresora.)
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 10000);

        $this->lectura($admin, $contract, $printer, today()->subDays(40)->toDateString(), 10000, ['k' => 80]);
        $this->lectura($admin, $contract, $printer, today()->subDays(20)->toDateString(), 12900, ['k' => 10]);
        $this->lectura($admin, $contract, $printer, today()->subDays(19)->toDateString(), 13000, ['k' => 100]);
        $this->lectura($admin, $contract, $printer, today()->toDateString(), 16000, ['k' => 15]);

        $this->assertSame(2950, $this->service->rendimientoReal($printer->printer_model_id));

        // Tres tramos con outlier: 2.900 / 3.000 / 1.000.000 ⇒ mediana 3.000
        // (el promedio se dispararía; la mediana no).
        [$contract2, $printer2] = $this->setupContractWithPrinter($admin, 10000);

        $this->lectura($admin, $contract2, $printer2, today()->subDays(50)->toDateString(), 10000, ['k' => 80]);
        $this->lectura($admin, $contract2, $printer2, today()->subDays(30)->toDateString(), 12900, ['k' => 10]);
        $this->lectura($admin, $contract2, $printer2, today()->subDays(29)->toDateString(), 13000, ['k' => 100]);
        $this->lectura($admin, $contract2, $printer2, today()->subDays(10)->toDateString(), 16000, ['k' => 15]);
        $this->lectura($admin, $contract2, $printer2, today()->subDays(9)->toDateString(), 16100, ['k' => 100]);
        $this->lectura($admin, $contract2, $printer2, today()->toDateString(), 1016100, ['k' => 20]);

        $this->assertSame(3000, $this->service->rendimientoReal($printer2->printer_model_id));

        // Modelo sin lecturas ⇒ null (nunca inventar).
        $brand = PrinterBrand::firstOrCreate(['slug' => 'hp'], ['nombre' => 'HP']);
        $modelVacio = PrinterModel::firstOrCreate(['brand_id' => $brand->id, 'nombre' => 'Modelo Vacio ' . uniqid()]);
        $this->assertNull($this->service->rendimientoReal($modelVacio->id));
    }

    public function test_costo_toner_por_pagina_promedio_ponderado_y_rendimiento(): void
    {
        $admin = $this->adminUser();
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 10000);

        // Promedio ponderado por cantidad: (1×100 + 3×200) ÷ 4 = 175.
        $toner = $this->toner();
        $this->entrega($admin, $contract, $toner, 1, 100.0);
        $this->entrega($admin, $contract, $toner, 3, 200.0);

        // Tramos entre resets: 2.900 y 3.000 ⇒ mediana 2.950.
        $this->lectura($admin, $contract, $printer, today()->subDays(40)->toDateString(), 10000, ['k' => 80]);
        $this->lectura($admin, $contract, $printer, today()->subDays(20)->toDateString(), 12900, ['k' => 10]);
        $this->lectura($admin, $contract, $printer, today()->subDays(19)->toDateString(), 13000, ['k' => 100]);
        $this->lectura($admin, $contract, $printer, today()->toDateString(), 16000, ['k' => 15]);

        $resultado = $this->service->costoTonerPorPaginaPorImpresora([$printer->id]);

        $this->assertEquals(175.0, $resultado[(string) $printer->id]['costo_toner_promedio']);
        $this->assertEqualsWithDelta(175 / 2950, $resultado[(string) $printer->id]['costo_toner_por_pagina'], 0.000001);
    }

    public function test_costo_toner_por_pagina_null_sin_entregas_o_sin_rendimiento(): void
    {
        $admin = $this->adminUser();

        // Con niveles capturados pero sin entregas ⇒ ambos null.
        [$contractA, $printerA] = $this->setupContractWithPrinter($admin, 10000);
        $this->lectura($admin, $contractA, $printerA, today()->subDays(20)->toDateString(), 10000, ['k' => 80]);
        $this->lectura($admin, $contractA, $printerA, today()->toDateString(), 13000, ['k' => 100]);

        $sinEntregas = $this->service->costoTonerPorPaginaPorImpresora([$printerA->id])[(string) $printerA->id];
        $this->assertNull($sinEntregas['costo_toner_promedio']);
        $this->assertNull($sinEntregas['costo_toner_por_pagina']);

        // Con entregas pero sin niveles capturados ⇒ promedio sí, por página
        // no (sin rendimientoReal no se inventa).
        [$contractB, $printerB] = $this->setupContractWithPrinter($admin, 10000);
        $this->entrega($admin, $contractB, $this->toner(), 2, 150.0);

        $sinRendimiento = $this->service->costoTonerPorPaginaPorImpresora([$printerB->id])[(string) $printerB->id];
        $this->assertEquals(150.0, $sinRendimiento['costo_toner_promedio']);
        $this->assertNull($sinRendimiento['costo_toner_por_pagina']);
    }

    public function test_costo_toner_por_pagina_comparte_rendimiento_entre_impresoras_del_modelo(): void
    {
        $admin = $this->adminUser();
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 10000);

        // Hermana del mismo modelo: el rendimiento (mediana por modelo) se
        // calcula una vez para las dos del lote.
        $hermana = Printer::create([
            'marca' => 'HP',
            'modelo' => 'LaserJet Pro M404',
            'printer_model_id' => $printer->printer_model_id,
            'num_serie' => 'SN-' . uniqid(),
            'fecha_adquisicion' => today(),
            'codigo_negocio' => 'EQ-' . uniqid(),
            'estado' => PrinterStatus::RENTADA,
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

        $contract->printers()->attach($hermana->id, [
            'fecha_asignacion' => today()->subDays(30),
            'lectura_inicial' => 0,
            'activa' => true,
        ]);

        // Solo la primera hermana tiene lecturas ⇒ rendimiento del modelo.
        $this->lectura($admin, $contract, $printer, today()->subDays(40)->toDateString(), 10000, ['k' => 80]);
        $this->lectura($admin, $contract, $printer, today()->subDays(20)->toDateString(), 12900, ['k' => 10]);
        $this->lectura($admin, $contract, $printer, today()->subDays(19)->toDateString(), 13000, ['k' => 100]);
        $this->lectura($admin, $contract, $printer, today()->toDateString(), 16000, ['k' => 15]);

        $toner = $this->toner();
        $this->entrega($admin, $contract, $toner, 2, 295.0);
        $this->entrega($admin, $contract, $toner, 2, 295.0);

        $resultado = $this->service->costoTonerPorPaginaPorImpresora([$printer->id, $hermana->id]);

        // Ambas: promedio 295 ÷ mediana 2.950 = 0,1 exacto por página.
        $this->assertEqualsWithDelta(0.1, $resultado[(string) $printer->id]['costo_toner_por_pagina'], 0.000001);
        $this->assertEqualsWithDelta(0.1, $resultado[(string) $hermana->id]['costo_toner_por_pagina'], 0.000001);
    }

    public function test_estimados_expone_costo_toner_promedio_y_por_pagina(): void
    {
        $admin = $this->adminUser();
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 10000);

        // 295 ÷ 2.950 = 0,1 exacto.
        $this->entrega($admin, $contract, $this->toner(), 1, 295.0);
        $this->lectura($admin, $contract, $printer, today()->subDays(40)->toDateString(), 10000, ['k' => 80]);
        $this->lectura($admin, $contract, $printer, today()->subDays(20)->toDateString(), 12900, ['k' => 10]);
        $this->lectura($admin, $contract, $printer, today()->subDays(19)->toDateString(), 13000, ['k' => 100]);
        $this->lectura($admin, $contract, $printer, today()->toDateString(), 16000, ['k' => 15]);

        $estimados = $this->service->estimados($printer);

        $this->assertEquals(295.0, $estimados['costo_toner_promedio']);
        $this->assertEqualsWithDelta(0.1, $estimados['costo_toner_por_pagina'], 0.000001);

        // Sin entregas ni niveles ⇒ nulls (aditivo, nunca inventa).
        [$contract2, $printer2] = $this->setupContractWithPrinter($admin, 10000);
        $estimados2 = $this->service->estimados($printer2);

        $this->assertNull($estimados2['costo_toner_promedio']);
        $this->assertNull($estimados2['costo_toner_por_pagina']);
    }
}
