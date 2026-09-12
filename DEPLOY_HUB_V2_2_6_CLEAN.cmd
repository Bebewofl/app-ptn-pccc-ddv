@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title HUB-PTN V2.2.6 - Clean Production Deploy

echo ============================================================
echo HUB-PTN V2.2.6 - CLEAN PRODUCTION DEPLOY
echo Source: GitHub release-hub-v2.2.6-clean
echo Target: app-ptn-pccc / https://app-ptn-pccc.web.app
echo Purpose: remove explanatory/test-looking UI text only.
echo ============================================================
echo.

where git >nul 2>nul || (echo ERROR: Git not found.& pause& exit /b 1)
where node >nul 2>nul || (echo ERROR: Node.js not found.& pause& exit /b 1)
where npm >nul 2>nul || (echo ERROR: npm not found.& pause& exit /b 1)

set "CI_SHA=f3044e51dce42685d453721358e1b006dad66692"

echo [1/6] Fetching locked clean V2.2.6 source from GitHub...
git fetch origin release-hub-v2.2.6-clean
if errorlevel 1 goto :fail
for /f "delims=" %%I in ('git rev-parse origin/release-hub-v2.2.6-clean') do set "REL_SHA=%%I"
if not defined REL_SHA goto :fail
echo Clean release commit: %REL_SHA%

echo Verifying release content against CI-tested source...
git diff --quiet %CI_SHA% %REL_SHA% -- src rules config baseline VERSION.json VERSION.production.json package.json package-lock.json scripts tests
if errorlevel 1 (
  echo ERROR: Clean release content differs from CI-tested source.
  echo Production unchanged.
  pause
  exit /b 1
)
echo CI guard: OK. Application source, Rules and production build match the GitHub Actions-tested source.

set "WORKTREE=%TEMP%\hub-v226-clean-%RANDOM%-%RANDOM%"
echo [2/6] Creating isolated temporary worktree...
git worktree add --detach "%WORKTREE%" "%REL_SHA%"
if errorlevel 1 goto :fail
pushd "%WORKTREE%"

echo [3/6] Installing locked tools...
call npm ci --ignore-scripts --no-audit --no-fund
if errorlevel 1 goto :workfail

echo [4/6] Running source, regression and production-build checks...
call npm run check
if errorlevel 1 goto :workfail

echo NOTE: Local Java emulator test is skipped on this computer.
echo       The matching application source already passed Firestore Rules + realtime emulator tests in GitHub Actions.

echo [5/6] Verifying guarded production package...
call npm run build:production
if errorlevel 1 goto :workfail

echo.
echo Local checks PASSED and CI Rules guard PASSED.
echo Production has NOT changed yet.
echo.
echo Checking Firebase login on this computer...
node node_modules/firebase-tools/lib/bin/firebase.js projects:list --non-interactive >nul 2>nul
if errorlevel 1 (
  echo Firebase login is required once on this computer.
  node node_modules/firebase-tools/lib/bin/firebase.js login
  if errorlevel 1 goto :workfail
)

echo.
echo READY TO DEPLOY CLEAN HUB V2.2.6 to PRODUCTION.
set /p "CONFIRM=Type DEPLOY then press Enter: "
if /I not "%CONFIRM%"=="DEPLOY" (
  echo Cancelled. Production unchanged.
  goto :cleanup_ok
)

echo [6/6] Deploying Hosting and Firestore Rules to app-ptn-pccc...
node scripts/deploy-production.mjs
if errorlevel 1 goto :workfail

echo.
echo ============================================================
echo DEPLOY SUCCESS - HUB V2.2.6 CLEAN FIX
echo Production: https://app-ptn-pccc.web.app
echo ============================================================
start "" "https://app-ptn-pccc.web.app/?cleanUi=2"
goto :cleanup_ok

:workfail
echo.
echo ERROR: Deployment stopped. If failure happened before step [6/6], Production is unchanged.
echo If Firebase failed during [6/6], send this screen before doing anything else.
popd
git worktree remove --force "%WORKTREE%" >nul 2>nul
pause
exit /b 1

:cleanup_ok
popd
git worktree remove --force "%WORKTREE%" >nul 2>nul
echo Temporary build folder removed.
pause
exit /b 0

:fail
echo.
echo ERROR: Could not prepare the locked clean V2.2.6 source. Production unchanged.
pause
exit /b 1
