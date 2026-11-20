@echo off
setlocal
cd /d "%~dp0"
title HUB-HFI V3.0 LITE - LOCAL EMULATOR ONLY
echo ==================================================
echo HUB V3.0 LITE - LOCAL TEST, NO PRODUCTION DEPLOY
echo No real Firebase login or business data required.
echo ==================================================
where node >nul 2>nul || (echo Node.js 22 required.& pause& exit /b 1)
where java >nul 2>nul || (echo Java 21 required.& pause& exit /b 1)
call npm ci --ignore-scripts --no-audit --no-fund
if errorlevel 1 goto fail
call npm --prefix functions-lite ci --ignore-scripts --no-audit --no-fund
if errorlevel 1 goto fail
node --check src/lite/lite.js
if errorlevel 1 goto fail
node scripts/build-lite.mjs
if errorlevel 1 goto fail
node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --only auth,firestore,storage,functions,hosting --project demo-hub-lite --config firebase.lite.emulator.json "node scripts/lite-demo.mjs"
if errorlevel 1 goto fail
exit /b 0
:fail
echo Local preview stopped. No production deployment.
pause
exit /b 1
