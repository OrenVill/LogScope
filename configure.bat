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

set /p USER_BACKEND="Enter backend port [default: 3000]: "
if not "!USER_BACKEND!"=="" set "BACKEND_PORT=!USER_BACKEND!"

echo.
echo Configuration:
echo   Backend:  http://localhost:%BACKEND_PORT%
echo   Frontend (for development only): http://localhost:5173

echo.

REM Copy .env.example to .env (overwrite) then update values
echo Copying .env.example to .env (overwriting)...
copy /Y .env.example .env > nul

REM Update .env file with ports (based on .env.example)
for /f "delims=" %%A in (.env.example) do (
    set "line=%%A"
    setlocal enabledelayedexpansion
    set "line=!line:PORT=3000=PORT=%BACKEND_PORT%!"
    set "line=!line:VITE_API_URL=http://localhost:3000=VITE_API_URL=http://localhost:%BACKEND_PORT%!"
    echo !line! >> .env.tmp
    endlocal
)

move /Y .env.tmp .env > nul
echo Updated .env file
echo.
echo .env updated — PORT=%BACKEND_PORT%
echo.
pause
