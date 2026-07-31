<?php

namespace Tests\Feature;

use App\Enums\TipoComprobante;
use App\Exceptions\BusinessRuleException;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use App\Models\XmlComprobante;
use App\Services\Cfdi\CfdiParser;
use App\Services\CfdiService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class CfdiImportTest extends TestCase
{
    use RefreshDatabase;

    private function createUser(): User
    {
        return User::create([
            'nombre' => 'Socio Test',
            'correo' => 'socio@test.com',
            'contrasena_hash' => 'password',
            'telefono' => '555-0100',
            'activo' => true,
            'fecha_creacion' => now(),
        ]);
    }

    private function createClient(User $user, string $rfc = 'CTS010101ABC'): Client
    {
        return Client::create([
            'razon_social' => 'Cliente Test SA',
            'rfc' => $rfc,
            'nombre_contacto' => 'Contacto',
            'telefono' => '555-0200',
            'correo' => 'cliente@test.com',
            'direccion_instalacion' => 'Calle Falsa 123',
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);
    }

    private function fixture(string $name): string
    {
        return file_get_contents(__DIR__ . '/../Fixtures/' . $name);
    }

    private function xmlFile(string $name, string $filename = 'factura.xml'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($filename, $this->fixture($name));
    }

    public function test_parsea_cfdi_4_0_correctamente(): void
    {
        $parsed = app(CfdiParser::class)->parse($this->fixture('cfdi_ingreso_4.0.xml'));

        $this->assertSame('4.0', $parsed['version']);
        $this->assertSame('A1B2C3D4-1111-2222-3334-1234567890AB', $parsed['uuid']);
        $this->assertSame('A', $parsed['serie']);
        $this->assertSame('1', $parsed['folio']);
        $this->assertSame('A1', $parsed['serie_folio']);
        $this->assertSame('I', $parsed['tipo_comprobante']);
        $this->assertSame('CTS010101ABC', $parsed['rfc_receptor']);
        $this->assertSame('AAA010101AAA', $parsed['rfc_emisor']);
        $this->assertEquals(1000.00, $parsed['subtotal']);
        $this->assertEquals(1160.00, $parsed['total']);
        $this->assertEquals(160.00, $parsed['iva_trasladado']);
        $this->assertCount(1, $parsed['conceptos']);
        $this->assertSame('Renta mensual de impresora', $parsed['conceptos'][0]['descripcion']);
    }

    public function test_parsea_cfdi_3_3_correctamente(): void
    {
        $parsed = app(CfdiParser::class)->parse($this->fixture('cfdi_ingreso_3.3.xml'));

        $this->assertSame('3.3', $parsed['version']);
        $this->assertSame('Z9Y8X7W6-3333-4444-5556-9876543210FE', $parsed['uuid']);
        $this->assertSame('B', $parsed['serie']);
        $this->assertSame('PPD', $parsed['metodo_pago']);
        $this->assertEquals(580.00, $parsed['total']);
    }

    public function test_import_es_idempotente_por_uuid(): void
    {
        $user = $this->createUser();
        $service = app(CfdiService::class);

        $first = $service->importFiles([$this->xmlFile('cfdi_ingreso_4.0.xml')], $user);
        $this->assertCount(1, $first);
        $this->assertSame('importado', $first[0]['estado']);
        $this->assertNotNull($first[0]['xml_comprobante']);

        // Reimportar el mismo UUID no duplica.
        $second = $service->importFiles([$this->xmlFile('cfdi_ingreso_4.0.xml', 'otra.xml')], $user);
        $this->assertSame('duplicado', $second[0]['estado']);
        $this->assertSame(1, XmlComprobante::count());
    }

    public function test_auto_asigna_cliente_por_rfc(): void
    {
        $user = $this->createUser();
        $this->createClient($user, 'CTS010101ABC');

        $result = app(CfdiService::class)->importFiles([$this->xmlFile('cfdi_ingreso_4.0.xml')], $user);

        $comprobante = $result[0]['xml_comprobante'];
        $this->assertNotNull($comprobante->receptor_id, 'El RFC del receptor debio matchear con un cliente.');
        $this->assertSame('asignado', $comprobante->estado_cliente);
    }

    public function test_cliente_desconocido_queda_sin_asignar(): void
    {
        $user = $this->createUser();

        $result = app(CfdiService::class)->importFiles([$this->xmlFile('cfdi_ingreso_3.3.xml')], $user);

        $comprobante = $result[0]['xml_comprobante'];
        $this->assertNull($comprobante->receptor_id);
        $this->assertSame('sin_cliente', $comprobante->estado_cliente);
    }

    public function test_auto_enlaza_factura_por_serie_folio(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user, 'CTS010101ABC');

        // Factura manual con el mismo numero que el Serie-Folio del CFDI (A1).
        $invoice = Invoice::create([
            'numero_factura' => 'A1',
            'cliente_id' => $client->id,
            'fecha_emision' => '2026-07-01',
            'fecha_vencimiento' => '2026-08-01',
            'monto_total' => 1160,
            'monto_pagado' => 0,
            'saldo_pendiente' => 1160,
            'estado' => 'PENDIENTE',
            'socio_id' => $user->id,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);

        app(CfdiService::class)->importFiles([$this->xmlFile('cfdi_ingreso_4.0.xml')], $user);

        $this->assertEquals(
            XmlComprobante::first()->id,
            $invoice->fresh()->xml_comprobante_id,
            'La factura debio auto-enlazarse al CFDI con el mismo Serie-Folio.'
        );
    }

    public function test_generate_invoice_crea_factura_con_xml_comprobante_id(): void
    {
        $user = $this->createUser();
        $this->createClient($user, 'CTS010101ABC');

        $comprobante = app(CfdiService::class)
            ->importFiles([$this->xmlFile('cfdi_ingreso_4.0.xml')], $user)[0]['xml_comprobante'];

        $invoice = app(CfdiService::class)->generateInvoice($comprobante, $user, []);

        $this->assertSame('A1', $invoice->numero_factura);
        $this->assertEquals(1160.00, (float) $invoice->monto_total);
        $this->assertEquals(1160.00, (float) $invoice->saldo_pendiente);
        $this->assertNotNull($invoice->xml_comprobante_id);
        $this->assertEquals($comprobante->id, $invoice->xml_comprobante_id);
        $this->assertSame('conciliado', $comprobante->fresh()->estado_conciliacion);
    }

    public function test_generate_invoice_requiere_cliente_asignado(): void
    {
        $user = $this->createUser();

        // CFDI sin cliente (RFC no registrado).
        $comprobante = app(CfdiService::class)
            ->importFiles([$this->xmlFile('cfdi_ingreso_3.3.xml')], $user)[0]['xml_comprobante'];

        $this->expectException(BusinessRuleException::class);
        app(CfdiService::class)->generateInvoice($comprobante, $user, []);
    }

    public function test_generate_invoice_solo_aplica_a_ingreso(): void
    {
        $user = $this->createUser();
        $this->createClient($user, 'CTS010101ABC');

        $comprobante = app(CfdiService::class)
            ->importFiles([$this->xmlFile('cfdi_ingreso_4.0.xml')], $user)[0]['xml_comprobante'];
        // Forzar tipo egreso para validar la regla de negocio.
        $comprobante->tipo_comprobante = TipoComprobante::EGRESO;
        $comprobante->save();

        $this->expectException(BusinessRuleException::class);
        app(CfdiService::class)->generateInvoice($comprobante, $user, []);
    }

    public function test_link_y_unlink_factura(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user, 'CTS010101ABC');

        $comprobante = app(CfdiService::class)
            ->importFiles([$this->xmlFile('cfdi_ingreso_4.0.xml')], $user)[0]['xml_comprobante'];

        $invoice = Invoice::create([
            'numero_factura' => 'MANUAL-1',
            'cliente_id' => $client->id,
            'fecha_emision' => '2026-07-01',
            'fecha_vencimiento' => '2026-08-01',
            'monto_total' => 1000,
            'monto_pagado' => 0,
            'saldo_pendiente' => 1000,
            'estado' => 'PENDIENTE',
            'socio_id' => $user->id,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);

        app(CfdiService::class)->linkToInvoice($comprobante, $invoice->id);
        $this->assertEquals($comprobante->id, $invoice->fresh()->xml_comprobante_id);

        app(CfdiService::class)->unlink($comprobante);
        $this->assertNull($invoice->fresh()->xml_comprobante_id);
    }

    public function test_delete_bloqueado_si_esta_enlazado(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user, 'CTS010101ABC');

        $comprobante = app(CfdiService::class)
            ->importFiles([$this->xmlFile('cfdi_ingreso_4.0.xml')], $user)[0]['xml_comprobante'];

        $invoice = Invoice::create([
            'numero_factura' => 'MANUAL-2',
            'cliente_id' => $client->id,
            'fecha_emision' => '2026-07-01',
            'fecha_vencimiento' => '2026-08-01',
            'monto_total' => 1000,
            'monto_pagado' => 0,
            'saldo_pendiente' => 1000,
            'estado' => 'PENDIENTE',
            'socio_id' => $user->id,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);

        app(CfdiService::class)->linkToInvoice($comprobante, $invoice->id);

        $this->expectException(BusinessRuleException::class);
        app(CfdiService::class)->delete($comprobante);
    }

    public function test_un_cfdi_no_puede_vincularse_a_dos_facturas(): void
    {
        $user = $this->createUser();
        $client = $this->createClient($user, 'CTS010101ABC');

        $comprobante = app(CfdiService::class)
            ->importFiles([$this->xmlFile('cfdi_ingreso_4.0.xml')], $user)[0]['xml_comprobante'];

        $facturaA = Invoice::create([
            'numero_factura' => 'MANUAL-A',
            'cliente_id' => $client->id,
            'fecha_emision' => '2026-07-01',
            'fecha_vencimiento' => '2026-08-01',
            'monto_total' => 1000,
            'monto_pagado' => 0,
            'saldo_pendiente' => 1000,
            'estado' => 'PENDIENTE',
            'socio_id' => $user->id,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);

        app(CfdiService::class)->linkToInvoice($comprobante, $facturaA->id);

        // Intentar vincular el MISMO CFDI a otra factura debe fallar (1:1).
        $facturaB = Invoice::create([
            'numero_factura' => 'MANUAL-B',
            'cliente_id' => $client->id,
            'fecha_emision' => '2026-07-02',
            'fecha_vencimiento' => '2026-08-02',
            'monto_total' => 500,
            'monto_pagado' => 0,
            'saldo_pendiente' => 500,
            'estado' => 'PENDIENTE',
            'socio_id' => $user->id,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);

        $this->expectException(BusinessRuleException::class);
        app(CfdiService::class)->linkToInvoice($comprobante, $facturaB->id);
    }

    public function test_delete_cascade_conceptos(): void
    {
        $user = $this->createUser();

        $comprobante = app(CfdiService::class)
            ->importFiles([$this->xmlFile('cfdi_ingreso_4.0.xml')], $user)[0]['xml_comprobante'];

        $this->assertGreaterThan(0, $comprobante->conceptos()->count());

        app(CfdiService::class)->delete($comprobante);

        $this->assertSame(0, \DB::table('xml_conceptos')->where('xml_comprobante_id', $comprobante->id)->count());
    }

    public function test_rechaza_xml_que_no_es_cfdi(): void
    {
        $this->expectException(BusinessRuleException::class);

        app(CfdiParser::class)->parse('<root><foo>bar</foo></root>');
    }

    public function test_import_devuelve_resultado_error_para_xml_malo(): void
    {
        $user = $this->createUser();
        $badFile = UploadedFile::fake()->createWithContent('malo.xml', '<root><foo>bar</foo></root>');

        $result = app(CfdiService::class)->importFiles([$badFile], $user);

        $this->assertSame('error', $result[0]['estado']);
        $this->assertNull($result[0]['xml_comprobante']);
        $this->assertNotNull($result[0]['errores']);
    }
}
