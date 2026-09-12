@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title HUB-PTN - RESET TEST DATA

echo ============================================================
echo HUB-PTN - ONE-TIME TEST DATA RESET
echo Project: app-ptn-pccc
echo.
echo WILL DELETE TEST/OPERATIONAL DATA:
echo - hub_cases (including private_notes)
echo - hub_case_events
echo - hub_comments
echo - hub_interdept_chat
echo - hub_pins
echo - hub_meal_reports
echo - hub_meal_public_status
echo - hub_meal_department_reports
echo - hub_meal_guest_reports
echo - hub_quality_handoffs
echo - hub_audit_logs
echo - hub_meta/counters
echo.
echo WILL KEEP:
echo - hub_access (users, roles, permissions)
echo - Firebase Authentication accounts
echo - Firestore Rules and app configuration
echo ============================================================
echo.

where node >nul 2>nul || (echo ERROR: Node.js not found.& pause& exit /b 1)
where npm >nul 2>nul || (echo ERROR: npm not found.& pause& exit /b 1)

if not exist "node_modules\firebase-tools\lib\bin\firebase.js" (
  echo Installing locked Firebase tools...
  call npm ci --ignore-scripts --no-audit --no-fund
  if errorlevel 1 goto :fail
)

set "FIREBASE=node_modules\firebase-tools\lib\bin\firebase.js"

echo Checking Firebase login...
node "%FIREBASE%" projects:list --non-interactive >nul 2>nul
if errorlevel 1 (
  echo Firebase login is required.
  node "%FIREBASE%" login
  if errorlevel 1 goto :fail
)

echo.
echo FINAL CONFIRMATION:
echo This reset is intended only before official HUB use.
set /p "CONFIRM=Type RESET then press Enter: "
if /I not "%CONFIRM%"=="RESET" (
  echo Cancelled. No Firestore data was changed.
  pause
  exit /b 0
)

echo.
echo Deleting operational collections from app-ptn-pccc...
for %%C in (hub_cases hub_case_events hub_comments hub_interdept_chat hub_pins hub_meal_reports hub_meal_public_status hub_meal_department_reports hub_meal_guest_reports hub_quality_handoffs hub_audit_logs) do (
  set "CURRENT_DELETE=%%C"
  echo [DELETE] %%C
  node "%FIREBASE%" firestore:delete "%%C" --recursive --force --project app-ptn-pccc
  if errorlevel 1 goto :deletefail
)

set "CURRENT_DELETE=hub_meta/counters"
echo [DELETE] hub_meta/counters
node "%FIREBASE%" firestore:delete "hub_meta/counters" --force --project app-ptn-pccc
if errorlevel 1 goto :deletefail

echo.
echo ============================================================
echo RESET SUCCESS - HUB operational test data is clean.
echo Access users and permissions were preserved.
echo New real VM numbering will restart from VM-001.
echo ============================================================
start "" "https://app-ptn-pccc.web.app/?clean=1"
pause
exit /b 0

:deletefail
echo.
echo ERROR: Reset stopped while deleting %CURRENT_DELETE%.
echo Do not rerun an older copy of this script.
echo Fetch/Pull the latest develop branch and send this screen if the error remains.
pause
exit /b 1

:fail
echo.
echo ERROR: Reset stopped before deletion started.
echo Send this screen before continuing.
pause
exit /b 1
