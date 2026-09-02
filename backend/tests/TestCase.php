<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    /**
     * Guarda de BD de pruebas: corre DESPUES del boot de la app (config
     * disponible) y ANTES de que setUpTraits dispare RefreshDatabase
     * (migrate:fresh).
     *
     * Se implementa en setUpTraits (y no en refreshTestDatabase) porque las
     * clases de test que usan el trait RefreshDatabase directamente mezclan
     * sus metodos en la clase hija y sombrean cualquier override del padre:
     * una guarda en refreshTestDatabase seria invisible para ellas.
     *
     * La configuracion se FUERZA a redprint_test en vez de confiar en los
     * env de phpunit.xml: el contenedor define DB_DATABASE en su entorno
     * ($_SERVER) y gana sobre lo que escribe PHPUnit, incluso con
     * force="true"; lo mismo aplica con config cacheada (config:cache).
     * Sin este forzado, migrate:fresh borraria la BD de desarrollo.
     */
    protected function setUpTraits()
    {
        config([
            'database.default' => 'pgsql',
            'database.connections.pgsql.database' => 'redprint_test',
        ]);

        // Doble seguro (canario): nunca correr tests contra otra BD que no
        // sea la de pruebas.
        abort_if(
            config('database.connections.pgsql.database') !== 'redprint_test',
            500,
            'Los tests deben correr contra redprint_test; abortando para proteger la BD.'
        );

        return parent::setUpTraits();
    }
}
