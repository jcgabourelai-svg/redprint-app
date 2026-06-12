<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->api(prepend: [
            \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class,
        ]);

        $middleware->validateCsrfTokens(except: [
            '/api/*',
        ]);

        $middleware->alias([
            'role' => \App\Http\Middleware\EnsureUserRole::class,
        ]);

        // Configurar autenticación para SPA sin redirección
        $middleware->redirectGuestsTo(function ($request) {
            return null;
        });
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (\App\Exceptions\BusinessRuleException $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 422);
        });

        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, $request) {
            return response()->json([
                'message' => 'Unauthenticated.',
            ], 401);
        });
    })->create();
