@echo off
REM LogScope Quick Start Configuration Script for Windows
REM This script helps you start LogScope with custom ports

setlocal enabledelayedexpansion

echo.
echo ========================================
echo     LogScope Configuration
echo ========================================
echo.

set "BACKEND_PORT=3000"
set "FRONTEND_PORT=5173"

set /p USER_BACKEND="Enter backend port [default: 3000]: "
if not "!USER_BACKEND!"=="" set "BACKEND_PORT=!USER_BACKEND!"

set /p USER_FRONTEND="Enter frontend port [default: 5173]: "
if not "!USER_FRONTEND!"=="" set "FRONTEND_PORT=!USER_FRONTEND!"

echo.
echo Configuration:
echo   Backend:  http://localhost:%BACKEND_PORT%
echo   Frontend: http://localhost:%FRONTEND_PORT%
echo.

REM Create .env file if it doesn't exist
if not exist .env (
    echo Creating .env file...
    copy .env.example .env > nul
)

REM Update .env file with ports
for /f "delims=" %%A in (.env.example) do (
    set "line=%%A"
    setlocal enabledelayedexpansion
    set "line=!line:PORT=3000=PORT=%BACKEND_PORT%!"
    set "line=!line:VITE_PORT=5173=VITE_PORT=%FRONTEND_PORT%!"
    set "line=!line:VITE_API_URL=http://localhost:3000=VITE_API_URL=http://localhost:%BACKEND_PORT%!"
    echo !line! >> .env.tmp
    endlocal
)

move /Y .env.tmp .env > nul
echo Updated .env file
echo.

echo ========================================
echo Starting LogScope...
echo ========================================
echo.
echo You need to run these commands in separate terminals:
echo.
echo Terminal 1 (Backend):
echo   cd server ^&^& npm run dev
echo.
echo Terminal 2 (Frontend):
echo   cd web ^&^& npm run dev
echo.
echo Then open: http://localhost:%FRONTEND_PORT%
echo.
echo ---
echo Tip: You can also run them with custom ports directly:
echo   set PORT=%BACKEND_PORT% ^&^& npm run dev    (Backend)
echo   set VITE_PORT=%FRONTEND_PORT% ^&^& npm run dev (Frontend)
echo.
pause
