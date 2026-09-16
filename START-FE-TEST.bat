@echo off
setlocal enabledelayedexpansion
title AEPICK BEAUTY DNA - FE TEST (design preview)

REM ============================================================
REM  AEPICK BEAUTY DNA - FE TEST launcher
REM  Double-click to open every screen in a web browser.
REM  No backend, no tablet needed - design preview only.
REM  To stop: press Ctrl+C in this window, or close it.
REM ============================================================

cd /d "%~dp0"

echo.
echo  ============================================================
echo    AEPICK BEAUTY DNA   -   FE TEST  (xem va sua giao dien)
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
echo  [1/3] Node.js OK
node --version

REM --- 2) install packages (first run only) --------------------
if not exist "node_modules\vite" (
  echo.
  echo  [2/3] First run - installing packages. Needs internet, 3-5 min...
  call npm install
  if errorlevel 1 (
    echo.
    echo  [ERROR] Package install failed. Check your internet connection.
    pause
    exit /b 1
  )
) else (
  echo  [2/3] Packages OK
)

REM --- 3) start the FE test gallery ----------------------------
echo  [3/3] Starting FE TEST gallery...
echo.
echo  ------------------------------------------------------------
echo    GALLERY   http://localhost:5180/test.html    (tat ca man hinh)
echo.
echo    Sua file trong apps\kiosk\src  -^>  luu  -^>  trinh duyet tu doi
echo    To stop: press Ctrl+C in this window
echo  ------------------------------------------------------------
echo.

call npm run fe:test

echo.
echo  FE TEST stopped.
pause
