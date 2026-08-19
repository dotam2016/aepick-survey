@echo off
setlocal enabledelayedexpansion
title AEPICK BEAUTY DNA - Demo Server

REM ============================================================
REM  AEPICK BEAUTY DNA - demo launcher
REM  Double-click this file to start the demo server.
REM  The folder path is detected automatically.
REM  To stop: press Ctrl+C in this window, or close it.
REM ============================================================

cd /d "%~dp0"

echo.
echo  ============================================================
echo    AEPICK BEAUTY DNA   -   DEMO
echo  ============================================================
echo.

REM --- 1) check Node.js ---------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] Node.js is not installed.
  echo          Install the LTS version from https://nodejs.org
  echo.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set NODEMAJ=%%v
if !NODEMAJ! LSS 22 (
  echo  [ERROR] Node.js 22 or newer is required.
  node --version
  echo          Install the LTS version from https://nodejs.org
  echo.
  pause
  exit /b 1
)
echo  [1/4] Node.js OK
node --version

REM --- 2) install packages (first run only) --------------------
if not exist "node_modules\fastify" (
  echo.
  echo  [2/4] First run - installing packages. Needs internet, 3-5 min...
  call npm install
  if errorlevel 1 (
    echo.
    echo  [ERROR] Package install failed. Check your internet connection.
    pause
    exit /b 1
  )
) else (
  echo  [2/4] Packages OK
)

REM --- 3) build kiosk app --------------------------------------
echo  [3/4] Building kiosk screens...
call npm run demo:build >nul 2>nul
if errorlevel 1 (
  echo  [WARN] Build warning - continuing with the previous build.
  echo         Tip: pause Dropbox/OneDrive sync if this repeats.
)

REM --- 4) start server -----------------------------------------
echo  [4/4] Starting server...
echo.
echo  ------------------------------------------------------------
echo   * The TABLET address is printed below - open it on the tablet
echo   * If a certificate warning appears: Advanced - Proceed (once)
echo   * To stop: press Ctrl+C in this window
echo  ------------------------------------------------------------
echo.

set HTTPS=1

REM Staff PIN for the vote-complete screen (visit count / reward).
REM Change this before running in public.
set STAFF_PIN=1234

call npx tsx server/src/index.ts

echo.
echo  Server stopped.
pause
