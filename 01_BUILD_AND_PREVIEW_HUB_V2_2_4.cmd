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
echo Sua: PTN gui - R^&D nhan realtime va nguoc lai
echo Fix1: dong phien ban hien thi bat buoc la V2.2.4
echo Production: KHONG DOI
echo Firestore Rules: KHONG DEPLOY o buoc build
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build_v224.ps1"
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo.
  echo BUILD/PREVIEW THAT BAI - Production khong thay doi.
  pause
  exit /b %RC%
)
echo.
echo Dang ap dung FIX1 cho dong phien ban hien thi...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0patch_v224_version.ps1"
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo.
  echo VERSION FIX THAT BAI - Production khong thay doi.
  pause
  exit /b %RC%
)
echo.
echo ==========================================================
echo HUB V2.2.4 FIX1 PREVIEW DA SAN SANG
echo ==========================================================
echo Sidebar phai hien: Phien ban V2.2.4 - Tao boi Duong Duc Vuong
echo Sau khi Preview mo binh thuong, giai nen OUTPUT ZIP va chay:
echo 02_DEPLOY_RULES_V2_2_4_CHAT_SYNC_TEST.cmd
echo de test chat hai chieu PTN-R^&D.
echo.
pause
exit /b 0
