@echo off
title Attendance Monitoring System Launcher
color 0A

echo ===============================================================
echo       ATTENDANCE MONITORING SYSTEM - FULLSTACK RUNNER
echo ===============================================================
echo.

:: Ensure current working directory is the project directory
cd /d "%~dp0"

:: Check if virtual environment exists
if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found at .venv\Scripts\python.exe
    echo Please make sure the Python virtual environment is set up.
    pause
    exit /b 1
)

:: Check if frontend node_modules exists
if not exist "frontend\node_modules" (
    echo [*] Frontend dependencies not found. Installing node_modules...
    cd frontend && npm install && cd ..
)

:: Automatically free ports 8000 and 3000 if previously occupied
echo [*] Ensuring ports 8000 and 3000 are free...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [*] Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "AMS Backend - FastAPI & MongoDB Atlas" cmd /k "cd /d "%~dp0" && .venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000"

echo [*] Waiting for Backend & MongoDB Atlas connection to become ready...
set /a attempts=0
:WAIT_FOR_BACKEND
timeout /t 1 /nobreak >nul
set /a attempts+=1
curl.exe -s http://127.0.0.1:8000/api >nul 2>&1
if errorlevel 1 (
    if %attempts% lss 20 (
        goto WAIT_FOR_BACKEND
    ) else (
        echo [!] Backend took longer than expected to initialize. Proceeding anyway...
    )
) else (
    echo [OK] Backend API is live and responding!
)

echo [*] Starting React Frontend on http://localhost:3000 ...
start "AMS Frontend - React Vite" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo [*] Waiting 3 seconds for Vite dev server...
timeout /t 3 /nobreak >nul

echo.
echo ===============================================================
echo   SERVICES LAUNCHED SUCCESSFULLY!
echo ===============================================================
echo   - Frontend Portal  : http://localhost:3000
echo   - Backend API      : http://127.0.0.1:8000
echo   - Swagger API Docs : http://127.0.0.1:8000/docs
echo   - MongoDB Atlas    : Connected
echo ===============================================================
echo.

:: Open default browser to the web app
echo [*] Opening application in browser...
start http://localhost:3000

echo.
echo Press any key to exit this launcher window (services will stay running).
pause >nul
