@echo off
:: clear-logs.bat — Permanently delete all LogScope log entries via the API.
::
:: Usage:
::   clear-logs.bat [options]
::
:: Options:
::   /Y              Skip the confirmation prompt
::   /KEEP-STARRED   Keep pinned (starred) logs, delete everything else
::   /PORT <port>    Backend port (default: 8000)
::   /HOST <host>    Backend host (default: localhost)
::   /H              Show this help message

setlocal EnableDelayedExpansion

set "PORT=8000"
set "HOST=localhost"
set "SKIP_CONFIRM=0"
set "KEEP_STARRED=0"

:: Parse arguments
:parse_args
if "%~1"=="" goto :done_args
if /I "%~1"=="/Y"             set "SKIP_CONFIRM=1" & shift & goto :parse_args
if /I "%~1"=="/KEEP-STARRED"  set "KEEP_STARRED=1" & shift & goto :parse_args
if /I "%~1"=="/PORT"          set "PORT=%~2"        & shift & shift & goto :parse_args
if /I "%~1"=="/HOST"          set "HOST=%~2"        & shift & shift & goto :parse_args
if /I "%~1"=="/H"             goto :usage
echo Unknown option: %~1
goto :usage
:done_args

set "API_URL=http://%HOST%:%PORT%"
set "QUERY="
if "%KEEP_STARRED%"=="1" set "QUERY=?keepStarred=true"

echo.
echo ============================================
echo    LogScope - Clear All Logs
echo ============================================
echo.
echo   Target: %API_URL%
if "%KEEP_STARRED%"=="1" (
    echo   Pinned logs: kept
) else (
    echo   Pinned logs: also deleted
)
echo.

if "%SKIP_CONFIRM%"=="0" (
    echo   WARNING: This will permanently delete log entries.
    echo   This cannot be undone.
    echo.
    set /P CONFIRM="  Type 'yes' to confirm: "
    if /I "!CONFIRM!" NEQ "yes" (
        echo.
        echo   Aborted.
        exit /b 0
    )
    echo.
)

echo   Clearing logs...

curl -sf -X DELETE "%API_URL%/api/logs/all%QUERY%" ^
     -H "Accept: application/json" ^
     -o "%TEMP%\logscope_clear.json" 2>nul
if errorlevel 1 (
    echo.
    echo   ERROR: Failed to reach %API_URL%. Is the server running?
    exit /b 1
)

:: Extract deleted count (basic parsing without jq)
set "DELETED=?"
set "KEPT=0"
for /F "tokens=2 delims=:," %%A in ('findstr "deleted" "%TEMP%\logscope_clear.json" 2^>nul') do (
    set "DELETED=%%A"
)
for /F "tokens=2 delims=:}" %%A in ('findstr "keptStarred" "%TEMP%\logscope_clear.json" 2^>nul') do (
    set "KEPT=%%A"
)
del /Q "%TEMP%\logscope_clear.json" 2>nul

echo.
echo   Done.
echo     Deleted : %DELETED% log(s)
echo     Kept    : %KEPT% pinned log(s)
echo.
exit /b 0

:usage
echo.
echo Usage: clear-logs.bat [/Y] [/KEEP-STARRED] [/PORT ^<port^>] [/HOST ^<host^>] [/H]
echo.
echo   /Y              Skip the confirmation prompt
echo   /KEEP-STARRED   Keep pinned logs, delete everything else
echo   /PORT ^<port^>    Backend port (default: 8000)
echo   /HOST ^<host^>    Backend host (default: localhost)
echo   /H              Show this help
echo.
exit /b 1
