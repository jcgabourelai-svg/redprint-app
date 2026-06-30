<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    /**
     * Fuerza el nombre de la BD de pruebas (redprint_test) independientemente
     * de si la configuracion esta cacheada (config:cache).
     *
     * refreshTestDatabase() corre DESPUES del boot de la app (config disponible)
     * y ANTES de ejecutar migrate:fresh, asi que fijar el nombre aqui garantiza
     * que RefreshDatabase nunca opere sobre la BD de desarrollo, aun cuando
     * alguien ejecute `php artisan config:cache` antes de los tests.
     */
    protected function refreshTestDatabase()
    {
        // Doble seguro: nunca correr tests contra otra BD que no sea la de pruebas.
        abort_if(
            config('database.connections.pgsql.database') !== 'redprint_test',
            500,
            'Los tests deben correr contra redprint_test; abortando para proteger la BD.'
        );

        config([
            'database.default' => 'pgsql',
            'database.connections.pgsql.database' => 'redprint_test',
        ]);

        $this->beforeRefreshingDatabase();

        $this->usingInMemoryDatabase()
            ? $this->refreshInMemoryDatabase()
            : $this->refreshTestDatabaseWithRealConnection();

        $this->afterRefreshingDatabase();
    }
}
