@echo off
cd /d "%~dp0.."
echo === Sabana Market: base de datos con Docker ===
echo.

docker compose version >nul 2>&1
if errorlevel 1 (
  echo No se encuentra "docker". Instala Docker Desktop, abrelo y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

docker compose up -d
if errorlevel 1 (
  echo Fallo "docker compose up -d".
  pause
  exit /b 1
)

call npm run db:wait
if errorlevel 1 (
  pause
  exit /b 1
)

call npm run db:init
if errorlevel 1 (
  pause
  exit /b 1
)

echo.
echo Listo. Ejecuta: npm run dev
pause
