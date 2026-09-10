@echo off
setlocal enabledelayedexpansion
title AEPICK BEAUTY DNA - Demo Server (TUNNEL)

REM ============================================================
REM  AEPICK BEAUTY DNA - public tunnel launcher
REM
REM  Use this INSTEAD of START-DEMO.bat when you want the demo
REM  reachable from anywhere (phone on mobile data, remote viewer),
REM  or when the venue Wi-Fi blocks device-to-device connections.
REM
REM  Two windows open:
REM    1) this one  - the demo server
REM    2) cloudflared - shows the public https address
REM
REM  The tunnel exposes this PC to the internet.
REM  Close BOTH windows when the demo is over.
REM ============================================================

cd /d "%~dp0"

echo.
echo  ============================================================
echo    AEPICK BEAUTY DNA   -   DEMO  (PUBLIC TUNNEL)
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
  pause
  exit /b 1
)
echo  [1/5] Node.js OK

REM --- 1b) check .env -------------------------------------------
if not exist ".env" (
  echo.
  echo  [ERROR] .env file not found.
  echo          Copy .env.example to .env and paste your Supabase connection string.
  echo          (Supabase dashboard - Project Settings - Database - Connection string)
  echo.
  pause
  exit /b 1
)

REM --- 2) locate cloudflared ----------------------------------
set CFD=
where cloudflared >nul 2>nul
if not errorlevel 1 set CFD=cloudflared
if "!CFD!"=="" if exist "C:\Program Files (x86)\cloudflared\cloudflared.exe" set CFD="C:\Program Files (x86)\cloudflared\cloudflared.exe"
if "!CFD!"=="" if exist "C:\Program Files\cloudflared\cloudflared.exe" set CFD="C:\Program Files\cloudflared\cloudflared.exe"

if "!CFD!"=="" (
  echo.
  echo  [ERROR] cloudflared is not installed.
  echo.
  echo   Install it once with this command in PowerShell:
  echo      winget install --id Cloudflare.cloudflared -e
  echo.
  echo   Then run this file again.
  echo   ^(Or just use START-DEMO.bat for a same-Wi-Fi demo.^)
  echo.
  pause
  exit /b 1
)
echo  [2/5] cloudflared OK

REM --- 3) install packages (first run only) --------------------
if not exist "node_modules\fastify" (
  echo.
  echo  [3/5] First run - installing packages. Needs internet, 3-5 min...
  call npm install
  if errorlevel 1 (
    echo  [ERROR] Package install failed. Check your internet connection.
    pause
    exit /b 1
  )
) else (
  echo  [3/5] Packages OK
)

REM --- 4) build kiosk app --------------------------------------
echo  [4/5] Building kiosk screens...
call npm run demo:build >nul 2>nul
if errorlevel 1 (
  echo  [WARN] Build warning - continuing with the previous build.
)

REM --- 5) open the tunnel in a second window -------------------
echo  [5/5] Opening public tunnel...
start "AEPICK - Tunnel Address" cmd /k !CFD! tunnel --url http://localhost:8787 --no-autoupdate

echo.
echo  ------------------------------------------------------------
echo   * The PUBLIC address appears in the OTHER window titled
echo     "AEPICK - Tunnel Address"  (https://....trycloudflare.com)
echo     It takes about 5 seconds to appear.
echo   * Open that address on the tablet. No certificate warning.
echo   * The address CHANGES every time you restart the tunnel.
echo   * To stop: close BOTH windows.
echo  ------------------------------------------------------------
echo.

REM Tunnel mode: cloudflared terminates HTTPS, so the local server
REM runs plain HTTP. TUNNEL=1 also forces a random admin key.
set TUNNEL=1
set HTTPS=

REM Staff PIN for the vote-complete screen (visit count / reward).
REM Change this before running in public.
set STAFF_PIN=1234

call npx tsx server/src/index.ts

echo.
echo  Server stopped. Close the tunnel window too.
pause
