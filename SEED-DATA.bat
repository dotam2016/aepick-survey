@echo off
title AEPICK - Demo Data
cd /d "%~dp0"

echo.
echo  ============================================================
echo    AEPICK - fill the attract screen statistics
echo  ============================================================
echo.
echo    Run this while the demo server is running.
echo    (participant count / top DNA appear on the idle screen)
echo.
echo    1 = Fill demo data
echo    2 = Clear demo data
echo.
set /p CHOICE="Enter 1 or 2: "

if "%CHOICE%"=="1" (
  node tools/seed-demo.mjs
) else if "%CHOICE%"=="2" (
  node tools/seed-demo.mjs --clear
) else (
  echo  Invalid input.
)

echo.
pause
