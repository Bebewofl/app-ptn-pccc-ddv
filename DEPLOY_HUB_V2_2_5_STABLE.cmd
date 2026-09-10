@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title HUB-PTN V2.2.5 Stable-1 - Production Deploy

echo ============================================================
echo HUB-PTN V2.2.5 Stable-1 - SAFE PRODUCTION DEPLOY
echo Source: GitHub release-hub-v2.2.5-stable
echo Target: app-ptn-pccc / https://app-ptn-pccc.web.app
echo ============================================================
echo.

where git >nul 2>nul || (echo ERROR: Git not found.& pause& exit /b 1)
where node >nul 2>nul || (echo ERROR: Node.js not found.& pause& exit /b 1)
where npm >nul 2>nul || (echo ERROR: npm not found.& pause& exit /b 1)

echo [1/7] Fetching locked Stable-1 source from GitHub...
git fetch origin release-hub-v2.2.5-stable
if errorlevel 1 goto :fail
for /f "delims=" %%I in ('git rev-parse origin/release-hub-v2.2.5-stable') do set "REL_SHA=%%I"
if not defined REL_SHA goto :fail
echo Stable commit: %REL_SHA%

set "WORKTREE=%TEMP%\hub-v225-stable-%RANDOM%-%RANDOM%"
echo [2/7] Creating isolated temporary worktree...
git worktree add --detach "%WORKTREE%" "%REL_SHA%"
if errorlevel 1 goto :fail
pushd "%WORKTREE%"

echo [3/7] Installing locked tools...
call npm ci --ignore-scripts --no-audit --no-fund
if errorlevel 1 goto :workfail

echo [4/7] Running source and regression checks...
call npm run check
if errorlevel 1 goto :workfail

echo [5/7] Running Firestore Rules emulator tests...
call npm run test:rules
if errorlevel 1 goto :workfail

echo [6/7] Building guarded production package...
node scripts/build-production.mjs
if errorlevel 1 goto :workfail

echo.
echo All automated checks PASSED.
echo Production has NOT changed yet.
echo.
echo Checking Firebase login on this computer...
node node_modules/firebase-tools/lib/bin/firebase.js projects:list --non-interactive >nul 2>nul
if errorlevel 1 (
  echo Firebase login is required once on this computer.
  echo A browser sign-in window will open now.
  node node_modules/firebase-tools/lib/bin/firebase.js login
  if errorlevel 1 goto :workfail
)

echo.
echo READY TO DEPLOY HUB V2.2.5 Stable-1 to PRODUCTION.
set /p "CONFIRM=Type DEPLOY then press Enter: "
if /I not "%CONFIRM%"=="DEPLOY" (
  echo Cancelled. Production unchanged.
  goto :cleanup_ok
)

echo [7/7] Deploying Hosting and Firestore Rules to app-ptn-pccc...
node scripts/deploy-production.mjs
if errorlevel 1 goto :workfail

echo.
echo ============================================================
echo DEPLOY SUCCESS - HUB V2.2.5 Stable-1
echo Production: https://app-ptn-pccc.web.app
echo ============================================================
start "" "https://app-ptn-pccc.web.app/?fromDeploy=V225"
goto :cleanup_ok

:workfail
echo.
echo ERROR: Deployment stopped. Production may be unchanged or only partially updated if Firebase failed during the final deploy step.
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
echo ERROR: Could not prepare the locked Stable-1 source. Production unchanged.
pause
exit /b 1
