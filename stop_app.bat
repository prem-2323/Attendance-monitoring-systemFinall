@echo off
title Stop Attendance Monitoring System
color 0C

echo ===============================================================
echo     STOPPING ATTENDANCE MONITORING SYSTEM SERVICES...
echo ===============================================================
echo.

echo [*] Terminating Backend on Port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [*] Terminating Frontend on Port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo [OK] Both Backend and Frontend processes have been stopped cleanly.
timeout /t 2 /nobreak >nul
