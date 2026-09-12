<?php

namespace App\Services;

use App\Models\Contract;
use App\Models\Notification;
use App\Models\Printer;
use App\Models\Reading;
use App\Models\User;
use App\Support\TonerLevels;
use Illuminate\Support\Str;

/**
 * Alerta TONER_LOW: nace del evento de captura (sin scheduler). Al guardar
 * una lectura con cualquier tóner capturado por debajo del umbral, notifica
 * a los usuarios con operaciones.lecturas y al socio capturista, con dedupe
 * por impresora mientras exista una notificación no leída vigente.
 */
class TonerAlertService
{
    public const UMBRAL = 15;

    public const FRESCURA_DIAS = 7;

    private const NOMBRES_COLOR = [
        'k' => 'K',
        'c' => 'C',
        'm' => 'M',
        'y' => 'Y',
    ];

    public function evaluar(Reading $reading, Printer $printer): void
    {
        // Regularización rancia: la lectura llegó demasiado tarde para alertar.
        if ($reading->fecha?->lt(today()->subDays(self::FRESCURA_DIAS))) {
            return;
        }

        $bajos = $this->nivelesBajos($reading->niveles_toner);

        if ($bajos === []) {
            return;
        }

        $exists = Notification::where('tipo', 'TONER_LOW')
            ->where('referencia_tipo', 'Printer')
            ->where('referencia_id', $printer->id)
            ->where('leida', false)
            ->exists();

        if ($exists) {
            return;
        }

        $this->notificar($reading, $printer, $bajos);
    }

    /**
     * @return array<string, int> Clave del color => nivel capturado ≤ UMBRAL.
     */
    private function nivelesBajos(?array $niveles): array
    {
        if ($niveles === null || $niveles === []) {
            return [];
        }

        $bajos = [];
        foreach (TonerLevels::CLAVES as $clave) {
            $valor = $niveles[$clave] ?? null;
            if ($valor !== null && (int) $valor <= self::UMBRAL) {
                $bajos[$clave] = (int) $valor;
            }
        }

        return $bajos;
    }

    private function notificar(Reading $reading, Printer $printer, array $bajos): void
    {
        $destinatarios = User::withPermission('operaciones.lecturas')->get();

        if ($reading->socio_id !== null) {
            $socio = User::find($reading->socio_id);
            if ($socio) {
                $destinatarios->push($socio);
            }
        }

        $destinatarios = $destinatarios->unique('id');

        if ($destinatarios->isEmpty()) {
            return;
        }

        $mensaje = $this->construirMensaje($reading, $printer, $bajos);

        // Insert único (los UUID se generan a mano: HasUuids no dispara con
        // insert) en vez de N creates con boot de eventos bajo los locks de
        // la transacción de captura.
        $ahora = now();
        Notification::insert($destinatarios
            ->map(fn (User $usuario) => [
                'id' => (string) Str::uuid(),
                'usuario_id' => $usuario->id,
                'tipo' => 'TONER_LOW',
                'titulo' => 'Tóner bajo',
                'mensaje' => $mensaje,
                'leida' => false,
                'referencia_tipo' => 'Printer',
                'referencia_id' => $printer->id,
                'fecha' => $ahora,
                'created_at' => $ahora,
                'updated_at' => $ahora,
            ])
            ->all());
    }

    /**
     * "Tóner bajo (K: 10%, M: 5%) en HP LaserJet Pro (Recepción) — ACME SA".
     * Con datos incompletos (sin contrato/cliente) degrada con gracia.
     */
    private function construirMensaje(Reading $reading, Printer $printer, array $bajos): string
    {
        $niveles = implode(', ', array_map(
            fn ($clave) => sprintf('%s: %d%%', self::NOMBRES_COLOR[$clave], $bajos[$clave]),
            array_keys($bajos)
        ));

        $alias = $reading->contrato_id !== null
            ? $printer->assignments()->where('contrato_id', $reading->contrato_id)->where('activa', true)->value('alias')
            : null;

        $identidad = trim("{$printer->marca} {$printer->modelo}") . ($alias ? " ({$alias})" : '');

        $contract = $reading->contrato_id !== null
            ? Contract::with('client')->find($reading->contrato_id)
            : null;

        $razonSocial = $contract?->client?->razon_social;

        return $razonSocial !== null
            ? "Tóner bajo ({$niveles}) en {$identidad} — {$razonSocial}"
            : "Tóner bajo ({$niveles}) en {$identidad}";
    }
}
