@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title HUB-PTN - Rollback to V2.1.1

echo ============================================================
echo HUB-PTN - SAFE ROLLBACK TO V2.1.1
echo Target: app-ptn-pccc / https://app-ptn-pccc.web.app
echo ============================================================
echo.

where git >nul 2>nul || (echo ERROR: Git not found.& pause& exit /b 1)
where node >nul 2>nul || (echo ERROR: Node.js not found.& pause& exit /b 1)
where npm >nul 2>nul || (echo ERROR: npm not found.& pause& exit /b 1)

git fetch origin release-hub-v2.2.5-stable
if errorlevel 1 goto :fail
for /f "delims=" %%I in ('git rev-parse origin/release-hub-v2.2.5-stable') do set "REL_SHA=%%I"
set "WORKTREE=%TEMP%\hub-v211-rollback-%RANDOM%-%RANDOM%"
git worktree add --detach "%WORKTREE%" "%REL_SHA%"
if errorlevel 1 goto :fail
pushd "%WORKTREE%"
call npm ci --ignore-scripts --no-audit --no-fund
if errorlevel 1 goto :workfail

echo.
echo READY TO ROLLBACK HUB TO V2.1.1.
set /p "CONFIRM=Type ROLLBACK then press Enter: "
if /I not "%CONFIRM%"=="ROLLBACK" (
  echo Cancelled. Production unchanged.
  goto :cleanup_ok
)

node scripts/deploy-rollback-v211.mjs
if errorlevel 1 goto :workfail

echo.
echo ROLLBACK SUCCESS - HUB V2.1.1 restored.
start "" "https://app-ptn-pccc.web.app/?rollback=V211"
goto :cleanup_ok

:workfail
popd
git worktree remove --force "%WORKTREE%" >nul 2>nul
echo ERROR: Rollback stopped.
pause
exit /b 1

:cleanup_ok
popd
git worktree remove --force "%WORKTREE%" >nul 2>nul
pause
exit /b 0

:fail
echo ERROR: Could not prepare rollback source.
pause
exit /b 1
