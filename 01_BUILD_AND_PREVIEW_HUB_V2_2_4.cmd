@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title HUB-PTN V2.2.4 - BUILD AND PREVIEW
cls
echo ==========================================================
echo HUB-PTN V2.2.4 - CHAT TWO-WAY SYNC - BUILD + PREVIEW
echo ==========================================================
echo.
echo Nen nguon: HUB V2.1.1 dang production
echo Bao toan: Response/Audit fix V2.2.3
echo Sua: PTN gui - R&D nhan realtime va nguoc lai
echo Production: KHONG DOI
echo Firestore Rules: KHONG DEPLOY o buoc build
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build_v224.ps1"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo BUILD/PREVIEW THAT BAI - Production khong thay doi.
  pause
  exit /b %RC%
)
echo ==========================================================
echo HUB V2.2.4 PREVIEW DA SAN SANG
echo ==========================================================
echo Sau khi Preview mo binh thuong, giai nen OUTPUT ZIP va chay:
echo 02_DEPLOY_RULES_V2_2_4_CHAT_SYNC_TEST.cmd
echo de test chat hai chieu PTN-R&D.
echo.
pause
exit /b 0
