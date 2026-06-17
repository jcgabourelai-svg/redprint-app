# Bootstrap del entorno RedPrint para Windows (PowerShell).
# Equivalente de setup.sh. El contenedor "app" se encarga automaticamente
# (via entrypoint) de: composer install, key:generate, migrate, db:seed y
# storage:link. Solo se necesita: crear .env, asegurar frontend/dist y levantar.
$ErrorActionPreference = "Stop"

Write-Host "=== RedPrint Setup ===" -ForegroundColor Cyan

# 1. .env del compose (raiz).
if (-not (Test-Path -LiteralPath ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Creado .env desde .env.example"
    Write-Host ">> Ajusta DB_PASSWORD y APP_DOMAIN antes de desplegar a produccion <<"
}

# 2. .env del backend (Laravel).
if (-not (Test-Path -LiteralPath "backend\.env")) {
    Copy-Item "backend\.env.example" "backend\.env"
    Write-Host "Creado backend\.env desde backend\.env.example"
}

# 3. Frontend: nginx necesita frontend/dist; si falta, lo construye.
if (-not (Test-Path -LiteralPath "frontend\dist\index.html")) {
    Write-Host "Construyendo frontend..."
    Push-Location "frontend"
    try {
        if (-not (Test-Path -LiteralPath "node_modules")) { npm ci }
        if ($LASTEXITCODE -ne 0) { npm install }
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "Fallo la compilacion del frontend (npm run build)." }
    }
    finally { Pop-Location }
}

# 4. Puerto desde .env (por defecto 8080).
$appPort = "8080"
if (Test-Path -LiteralPath ".env") {
    $line = Get-Content ".env" | Where-Object { $_ -match '^APP_PORT=' } | Select-Object -Last 1
    if ($line) { $appPort = ($line -split '=', 2)[1].Trim() }
}

# 5. Levanta el stack (el entrypoint de "app" hace el resto automaticamente).
Write-Host "Levantando contenedores..."
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { throw "docker compose fallo." }

Write-Host ""
Write-Host "=== Listo ===" -ForegroundColor Green
Write-Host "Frontend: http://localhost:$appPort"
Write-Host "API:      http://localhost:$appPort/api/v1"
Write-Host ""
Write-Host "El primer arranque tarda ~30-60s (composer install + migrate + seed)."
