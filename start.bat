@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ==========================================
echo          CANTEEN AI - NHOM 15
echo ==========================================
echo Dang chuan bi va khoi dong website...
echo.
where pwsh >nul 2>nul
if %errorlevel%==0 (
    pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1"
) else (
    powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1"
)
if errorlevel 1 (
    echo.
    echo Co loi khi khoi dong. Hay chup lai thong bao loi phia tren.
    pause
)
