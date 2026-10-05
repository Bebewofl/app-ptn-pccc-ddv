@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title HUB-PTN V2.2.8 - Closed-loop Tasks Preview

echo ============================================================
echo HUB-PTN V2.2.8 - CLOSED-LOOP TASKS PREVIEW
echo Target: HUB PTN TEST / https://hub-ptn-test.web.app
echo Production app-ptn-pccc: KHONG DOI
echo ============================================================
echo.

where git >nul 2>nul || (echo ERROR: Git not found.& pause& exit /b 1)
where node >nul 2>nul || (echo ERROR: Node.js not found.& pause& exit /b 1)
where npm >nul 2>nul || (echo ERROR: npm not found.& pause& exit /b 1)

for /f "delims=" %%I in ('git branch --show-current') do set "BRANCH=%%I"
if /I not "%BRANCH%"=="develop" (
  echo ERROR: Current branch must be develop. Current: %BRANCH%
  echo GitHub Desktop: select develop, Fetch origin and Pull origin first.
  pause
  exit /b 1
)

for /f "delims=" %%I in ('git status --porcelain') do set "DIRTY=1"
if defined DIRTY (
  echo ERROR: Local changes detected. Preview stopped.
  echo GitHub Desktop must show No local changes before running.
  pause
  exit /b 1
)

echo [1/6] Checking latest develop source...
git fetch origin develop
if errorlevel 1 goto :fail
for /f "delims=" %%I in ('git rev-parse HEAD') do set "LOCAL_SHA=%%I"
for /f "delims=" %%I in ('git rev-parse origin/develop') do set "REMOTE_SHA=%%I"
if /I not "%LOCAL_SHA%"=="%REMOTE_SHA%" (
  echo ERROR: This computer is not on latest develop.
  echo GitHub Desktop: Pull origin, then run again.
  pause
  exit /b 1
)

echo [2/6] Installing locked tools...
call npm ci --ignore-scripts --no-audit --no-fund
if errorlevel 1 goto :fail

echo [3/6] Running JavaScript, regression and build checks...
call npm run check
if errorlevel 1 goto :fail

echo [4/6] Building V2.2.8 test package...
call npm run build
if errorlevel 1 goto :fail

echo [5/6] Checking Firebase login...
node node_modules/firebase-tools/lib/bin/firebase.js projects:list --non-interactive >nul 2>nul
if errorlevel 1 (
  echo Firebase login required once on this computer.
  node node_modules/firebase-tools/lib/bin/firebase.js login
  if errorlevel 1 goto :fail
)

echo [6/6] Deploying TEST Hosting + TEST Firestore Rules...
node scripts/deploy-test-v228.mjs
if errorlevel 1 goto :fail

echo.
echo ============================================================
echo PREVIEW SUCCESS - HUB V2.2.8
echo Test URL: https://hub-ptn-test.web.app/?v=228
echo Production: KHONG DOI - V2.2.6 Clean
echo ============================================================
start "" "https://hub-ptn-test.web.app/?v=228"
pause
exit /b 0

:fail
echo.
echo ERROR: Preview stopped. Production was not changed.
pause
exit /b 1
