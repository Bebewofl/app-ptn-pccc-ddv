@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title HUB-PTN V2.2.3 - BUILD AND PREVIEW
cls
echo ==========================================================
echo HUB-PTN V2.2.3 - R&D RESPONSE + AUDIT FIX
echo ==========================================================
echo.
echo Nen nguon: HUB V2.1.1 dang production
echo Ket qua: V2.2.3 Hosting PREVIEW ONLY
echo Production: KHONG DOI
echo Firestore Rules: KHONG DEPLOY o buoc build
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build_v223.ps1"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo BUILD/PREVIEW THAT BAI - Production khong thay doi.
  pause
  exit /b %RC%
)
echo ==========================================================
echo HUB V2.2.3 PREVIEW DA SAN SANG TEST
echo ==========================================================
echo Xem Channel URL o phia tren.
echo Neu R&D van bi Permission denied khi Gui phan hoi,
echo chay file 02_DEPLOY_RULES_V2_2_3_RND_RESPONSE_TEST.cmd trong ZIP dau ra.
echo.
pause
exit /b 0
