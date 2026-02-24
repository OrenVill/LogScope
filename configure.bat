@echo off
REM LogScope Quick Start Configuration Script for Windows
REM This script helps you start LogScope with custom configuration

setlocal enabledelayedexpansion

echo.
echo ========================================
echo     LogScope Configuration
echo ========================================
echo.

set "BACKEND_PORT=3000"
set "CLEANUP_INTERVAL_MS=10000"
set "LOG_MAX_TOTAL=500"
set "LOG_MAX_AGE_MS=3600000"
set "LOG_DELETE_COUNT=100"

set /p BACKEND_PORT="Enter backend port [default: 3000]: " || set "BACKEND_PORT=3000"

echo.
echo ========================================
echo     Auto-Cleanup Configuration
echo ========================================
echo.

set /p CLEANUP_INTERVAL_MS="Cleanup check interval in milliseconds [default: 10000]: " || set "CLEANUP_INTERVAL_MS=10000"
set /p LOG_MAX_TOTAL="Maximum logs before cleanup triggers [default: 500]: " || set "LOG_MAX_TOTAL=500"
set /p LOG_MAX_AGE_MS="Delete logs older than (milliseconds) [default: 3600000]: " || set "LOG_MAX_AGE_MS=3600000"
set /p LOG_DELETE_COUNT="Logs to delete per cleanup [default: 100]: " || set "LOG_DELETE_COUNT=100"

echo.
echo Configuration:
echo   Backend:  http://localhost:%BACKEND_PORT%
echo   Frontend (for development only): http://localhost:5173
echo.
echo Cleanup Settings:
echo   Check interval: %CLEANUP_INTERVAL_MS%ms
echo   Capacity limit: %LOG_MAX_TOTAL% logs
echo   Delete age: %LOG_MAX_AGE_MS%ms
echo   Delete count: %LOG_DELETE_COUNT% logs per cleanup
echo.

REM Copy .env.example to .env (overwrite)
echo Copying .env.example to .env (overwriting)...
copy /Y .env.example .env > nul

REM Create temporary PowerShell script to do replacements (more reliable than batch findstr)
(
  echo [String]$content = Get-Content '.env' -Raw
  echo $content = $content -replace 'PORT=3000', 'PORT=%BACKEND_PORT%'
  echo $content = $content -replace 'VITE_API_URL=http://localhost:3000', 'VITE_API_URL=http://localhost:%BACKEND_PORT%'
  echo $content = $content -replace 'CLEANUP_INTERVAL_MS=.*', 'CLEANUP_INTERVAL_MS=%CLEANUP_INTERVAL_MS%'
  echo $content = $content -replace 'LOG_MAX_TOTAL=.*', 'LOG_MAX_TOTAL=%LOG_MAX_TOTAL%'
  echo $content = $content -replace 'LOG_MAX_AGE_MS=.*', 'LOG_MAX_AGE_MS=%LOG_MAX_AGE_MS%'
  echo $content = $content -replace 'LOG_DELETE_COUNT=.*', 'LOG_DELETE_COUNT=%LOG_DELETE_COUNT%'
  echo Set-Content '.env' $content -Encoding UTF8
) > update-env.ps1

powershell -ExecutionPolicy Bypass -File update-env.ps1
del update-env.ps1

echo Updated .env file
echo.
echo Configuration complete!
echo.
pause
