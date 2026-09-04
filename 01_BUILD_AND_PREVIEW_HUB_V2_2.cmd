@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title HUB-PTN V2.2 - BUILD AND PREVIEW
cls
echo ==========================================================
echo HUB-PTN V2.2 - XU LY LIEN PHONG - BUILD + PREVIEW
echo ==========================================================
echo.
echo Nen nguon: HUB V2.1.1 dang production
echo Ket qua: V2.2 Hosting PREVIEW ONLY
echo Production: KHONG DOI
echo Firestore Rules: KHONG DEPLOY o buoc nay
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build_v22.ps1"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo BUILD/PREVIEW THAT BAI - Production khong thay doi.
  pause
  exit /b %RC%
)
echo ==========================================================
echo HUB V2.2 PREVIEW DA SAN SANG TEST
echo ==========================================================
echo Xem URL Preview o phia tren.
echo KHONG chay Rules V2.2 cho den khi giao dien va VM bang tai khoan Truong phong PTN dat.
echo.
pause
exit /b 0
