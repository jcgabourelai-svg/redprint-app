<?php

namespace Database\Seeders;

use App\Enums\FieldRecordStatus;
use App\Enums\FieldRecordType;
use App\Models\Contract;
use App\Models\FieldRecord;
use App\Models\User;
use Illuminate\Database\Seeder;

class FieldRecordSeeder extends Seeder
{
    public function run(): void
    {
        $operador = User::where('correo', 'operador1@redprint.com')->first() ?? User::first();
        $admin = User::where('correo', 'admin@redprint.com')->first() ?? $operador;

        if (! $operador) {
            return;
        }

        // 1) PENDIENTE: lectura capturada en campo, sin regularizar
        FieldRecord::firstOrCreate(
            ['client_uuid' => 'demo-field-record-pendiente'],
            [
                'tipo' => FieldRecordType::LECTURA,
                'estado' => FieldRecordStatus::PENDIENTE,
                'nombre_cliente_reportado' => 'Tacos El Güero (sin dar de alta)',
                'direccion_reportada' => 'Av. Insurgentes 456, Col. Centro',
                'marca_reportada' => 'HP',
                'modelo_reportada' => 'LaserJet Pro M404',
                'num_serie_reportado' => 'VNC4G05567',
                'valor_contador' => 12345,
                'notas' => 'El cliente no aparece en el sistema; se capturó la lectura para no perderla.',
                'foto_evidencia' => 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
                'ubicacion_lat' => 19.4326077,
                'ubicacion_lng' => -99.133208,
                'capturado_en' => now()->subDays(2),
                'socio_id' => $operador->id,
                'creado_por' => $operador->id,
            ]
        );

        // 2) VINCULADO: regularizado contra el primer contrato del seed
        $contract = Contract::where('estado', 'ACTIVO')->orderBy('id')->first();
        if ($contract) {
            FieldRecord::firstOrCreate(
                ['client_uuid' => 'demo-field-record-vinculado'],
                [
                    'tipo' => FieldRecordType::ENTREGA_INSUMOS,
                    'estado' => FieldRecordStatus::VINCULADO,
                    'nombre_cliente_reportado' => $contract->client?->razon_social ?? 'Cliente de campo',
                    'marca_reportada' => 'Brother',
                    'modelo_reportada' => 'HL-L2350DW',
                    'num_serie_reportado' => 'U69876G2',
                    'articulos_entregados' => [
                        ['descripcion' => 'Tóner negro TN-730', 'cantidad' => 2],
                    ],
                    'notas' => 'Entrega de insumos en visita no programada.',
                    'capturado_en' => now()->subDays(5),
                    'socio_id' => $operador->id,
                    'creado_por' => $operador->id,
                    'cliente_id' => $contract->cliente_id,
                    'contrato_id' => $contract->id,
                    'vinculado_por' => $admin->id,
                    'vinculado_en' => now()->subDays(4),
                ]
            );
        }

        // 3) DESCARTADO: duplicado capturado por error
        FieldRecord::firstOrCreate(
            ['client_uuid' => 'demo-field-record-descartado'],
            [
                'tipo' => FieldRecordType::OTRO,
                'estado' => FieldRecordStatus::DESCARTADO,
                'nombre_cliente_reportado' => 'Cafetería La Esquina',
                'direccion_reportada' => 'Calle Morelos 12',
                'notas' => 'El operador capturó dos veces el mismo lugar.',
                'capturado_en' => now()->subDays(7),
                'socio_id' => $operador->id,
                'creado_por' => $operador->id,
                'vinculado_por' => $admin->id,
                'vinculado_en' => now()->subDays(6),
                'motivo_descarte' => 'Duplicado: el mismo lugar ya estaba registrado en otro registro de campo.',
            ]
        );
    }
}
