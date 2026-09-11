<?php

namespace App\Services;

use App\Exceptions\BusinessRuleException;
use App\Models\User;

/**
 * Canal de archivos entre la app y el orquestador del VPS (deploy/update.sh).
 *
 * La app NUNCA ejecuta shell ni docker: solo escribe la bandera `request`
 * dentro de storage/app/update/ (volumen app_storage). El cron del host la
 * reclama con `mv` atomico y lanza el orquestador, que es el UNICO que escribe
 * `status.json` y `version.json` y el unico que borra archivos. Este servicio
 * jamas escribe status ni borra nada: lee y anuncia.
 */
class UpdateService
{
    private string $base;

    /**
     * $base es inyectable para aislar el canal en tests (SystemUpdateTest
     * apunta a storage/app/update-testing y no toca el canal real de dev).
     */
    public function __construct(?string $base = null)
    {
        $this->base = $base ?? storage_path('app/update');
    }

    /**
     * Lee un JSON del canal; null si falta o esta corrupto.
     */
    public function readJson(string $file): ?array
    {
        $path = $this->base.DIRECTORY_SEPARATOR.$file;
        if (! is_file($path)) {
            return null;
        }

        $raw = file_get_contents($path);
        if ($raw === false) {
            return null;
        }

        $data = json_decode($raw, true);

        return is_array($data) ? $data : null;
    }

    /**
     * Estado reportado por el orquestador: 'inactivo' si nunca corrio
     * (o el status.json falta/esta corrupto), el valor del archivo en caso contrario.
     */
    public function estado(): string
    {
        $status = $this->readJson('status.json');

        return is_string($status['estado'] ?? null) ? $status['estado'] : 'inactivo';
    }

    /**
     * Estado efectivo para la API: el orquestador solo escribe
     * corriendo/listo/error, asi que entre el POST 202 y el reclamo del cron
     * (hasta ~1 min) status.json aun muestra el run anterior. Si hay bandera
     * pendiente y nada corre, reportamos en_cola para que la UI no confunda
     * el listo/error viejo con el presente (tambien cubre el re-encolado).
     */
    public function estadoEfectivo(): string
    {
        if ($this->estado() === 'corriendo') {
            return 'corriendo';
        }

        if ($this->hayBandera()) {
            return 'en_cola';
        }

        return $this->estado();
    }

    public function hayBandera(): bool
    {
        return is_file($this->base.DIRECTORY_SEPARATOR.'request');
    }

    /**
     * Escribe la bandera `request` que el cron reclamara. Lanza excepcion de
     * negocio si hay una actualizacion en curso o ya hay una en cola (el
     * orquestador re-encola por su cuenta si llega un pedido a mitad del run).
     * El cron NO registra el contenido de este archivo: es solo bitacora.
     */
    public function pedir(User $u): void
    {
        if ($this->estado() === 'corriendo') {
            throw new BusinessRuleException('Hay una actualizacion en curso. Espera a que termine.');
        }

        if ($this->hayBandera()) {
            throw new BusinessRuleException('Ya hay una actualizacion en cola.');
        }

        $this->ensureDir();

        $payload = json_encode([
            'pedida_por_id' => $u->id,
            'pedida_por_email' => $u->correo,
            'ts' => now()->utc()->toIso8601String(),
        ], JSON_THROW_ON_ERROR);

        // temp + rename: los lectores (cron del host) nunca ven un archivo a medio escribir.
        // Retornos verificados: si el volumen no es escribible, fallamos ruidoso (500)
        // en vez de responder 202 con una bandera que nunca existio.
        $tmp = $this->base.DIRECTORY_SEPARATOR.'request.tmp';

        if (@file_put_contents($tmp, $payload) === false) {
            throw new \RuntimeException('No se pudo escribir la bandera de actualizacion (canal no escribible).');
        }

        if (! @rename($tmp, $this->base.DIRECTORY_SEPARATOR.'request')) {
            @unlink($tmp);
            throw new \RuntimeException('No se pudo colocar la bandera de actualizacion (canal no escribible).');
        }
    }

    /**
     * Ultima version instalada (escrita por el orquestador al terminar):
     * {sha, rama, fecha} o null si nunca se actualizo por este canal.
     */
    public function version(): ?array
    {
        return $this->readJson('version.json');
    }

    /**
     * Cola del log del orquestador (tail <= 8 KB, ya limitado por update.sh).
     * null si no hay log.
     */
    public function log(): ?string
    {
        $path = $this->base.DIRECTORY_SEPARATOR.'update.log';
        if (! is_file($path)) {
            return null;
        }

        $raw = file_get_contents($path);

        return $raw === false || $raw === '' ? null : $raw;
    }

    private function ensureDir(): void
    {
        if (is_dir($this->base)) {
            return;
        }

        if (! @mkdir($this->base, 0775, true) && ! is_dir($this->base)) {
            throw new \RuntimeException('No se pudo crear el canal de actualizacion.');
        }
    }
}
