$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$downloads = Join-Path $env:USERPROFILE 'Downloads'
$searchDirs = @($root, (Split-Path -Parent $root), $downloads) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique

$candidates = @()
foreach ($d in $searchDirs) {
    $candidates += Get-ChildItem -Path $d -Filter 'HUB_PTN_V2_1_1_PRODUCTION_RULES_AND_ONBOARDING*.zip' -File -ErrorAction SilentlyContinue
    $candidates += Get-ChildItem -Path $d -Filter 'HUB_PTN_V2_1_1_ACCESS_SECURITY_COMPAT*.zip' -File -ErrorAction SilentlyContinue
}
$candidates = $candidates | Sort-Object LastWriteTime -Descending -Unique
if (-not $candidates -or $candidates.Count -eq 0) {
    throw 'Khong tim thay ZIP HUB V2.1.1. Dat ZIP V2.1.1 canh bo dung nay hoac trong Downloads.'
}
$source = $candidates[0]
Write-Host ('SOURCE: ' + $source.FullName) -ForegroundColor Cyan

$work = Join-Path $root '_HUB_V22_WORK'
if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory -Path $work | Out-Null
Expand-Archive -Path $source.FullName -DestinationPath $work -Force

$index = Join-Path $work 'public\index.html'
if (-not (Test-Path $index)) { throw 'ZIP nguon khong co public\index.html.' }

Copy-Item (Join-Path $root 'hub-v22.js') (Join-Path $work 'public\hub-v22.js') -Force
Copy-Item (Join-Path $root 'hub-v22.css') (Join-Path $work 'public\hub-v22.css') -Force

$html = Get-Content $index -Raw -Encoding UTF8
$html = $html -replace 'V2\.1\.1_ACCESS_SECURITY_COMPAT', 'V2.2_INTERDEPT_PREVIEW'
$html = [regex]::Replace($html, 'Phiên bản\s+V2\.1\.1\s*·\s*Tạo bởi Dương Đức Vượng', 'Phiên bản V2.2 · Tạo bởi Dương Đức Vượng')
if ($html -notmatch 'hub-v22\.css') {
    $html = $html -replace '</head>', "  <link rel=`"stylesheet`" href=`"hub-v22.css?v=220`">`r`n</head>"
}
if ($html -notmatch 'hub-v22\.js') {
    $html = $html -replace '</body>', "  <script src=`"hub-v22.js?v=220`"></script>`r`n</body>"
}
Set-Content -Path $index -Value $html -Encoding UTF8

# Remove old deployment CMD files from the derived V2.2 package to avoid accidental execution.
Get-ChildItem $work -Filter '*.cmd' -File -ErrorAction SilentlyContinue | Remove-Item -Force

# Preserve current V2.1 Rules as exact rollback baseline and derive V2.2 read rule.
$ruleCandidates = @(
    (Join-Path $work 'firestore.rules.V2_1_PRODUCTION'),
    (Join-Path $work 'firestore.rules.V2_1_PROPOSED_NOT_DEPLOYED'),
    (Join-Path $work 'firestore.rules')
)
$rulesSource = $ruleCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $rulesSource) { throw 'Khong tim thay Firestore Rules V2.1 trong ZIP nguon.' }
$rulesV21 = Get-Content $rulesSource -Raw -Encoding UTF8
$rollbackPath = Join-Path $work 'firestore.rules.V2_1_ROLLBACK'
Set-Content $rollbackPath $rulesV21 -Encoding UTF8

$rx = [regex]'(?s)(function\s+canReadCaseData\(d\)\s*\{\s*return\s+activeMember\(\)\s*&&\s*\(\s*isOwner\(\)\s*\|\|)'
$m = $rx.Match($rulesV21)
if (-not $m.Success) {
    throw 'Khong tim thay canReadCaseData(d) de tao Rules V2.2. Dung lai an toan.'
}
$insert = $m.Groups[1].Value + "`r`n        hasPermission(`"rnd.tech.overview`") ||"
$rulesV22 = $rulesV21.Substring(0, $m.Index) + $insert + $rulesV21.Substring($m.Index + $m.Length)
$rulesV22Path = Join-Path $work 'firestore.rules.V2_2_CANDIDATE'
Set-Content $rulesV22Path $rulesV22 -Encoding UTF8

@{ firestore = @{ rules = 'firestore.rules.V2_2_CANDIDATE' } } | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $work 'firebase.rules.v2_2.json') -Encoding UTF8
@{ firestore = @{ rules = 'firestore.rules.V2_1_ROLLBACK' } } | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $work 'firebase.rules.rollback.v2_1.json') -Encoding UTF8

$previewCmd = @'
@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title HUB-PTN V2.2 - PREVIEW
cls
echo ==========================================================
echo HUB-PTN V2.2 - XU LY LIEN PHONG - PREVIEW ONLY
echo ==========================================================
echo Production khong thay doi.
echo Firestore Rules khong deploy o buoc nay.
echo.
set "FB="
for /f "delims=" %%F in ('where firebase.cmd 2^>nul') do if not defined FB set "FB=%%F"
if not defined FB if exist "%APPDATA%\npm\firebase.cmd" set "FB=%APPDATA%\npm\firebase.cmd"
if not defined FB if exist "%USERPROFILE%\AppData\Roaming\npm\firebase.cmd" set "FB=%USERPROFILE%\AppData\Roaming\npm\firebase.cmd"
if not defined FB (echo ERROR: firebase.cmd not found.&pause&exit /b 10)
set "CFG=firebase.hosting.json"
if not exist "%CFG%" set "CFG=firebase.json"
call "%FB%" hosting:channel:deploy hub-v22-interdept --expires 30d --project app-ptn-pccc --config "%~dp0%CFG%"
if errorlevel 1 (echo PREVIEW FAILED. Production unchanged.&pause&exit /b 20)
echo.
echo HUB V2.2 PREVIEW COMPLETE.
echo Test Owner first. Do not deploy Rules until Owner test passes.
pause
'@
Set-Content (Join-Path $work '01_PREVIEW_HUB_V2_2_INTERDEPT.cmd') $previewCmd -Encoding ASCII

$rulesCmd = @'
@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title HUB-PTN V2.2 - RULES FOR RND HEAD TEST
cls
echo ==========================================================
echo FIRESTORE RULES V2.2 - RND HEAD PUBLIC OVERVIEW TEST
echo ==========================================================
echo.
echo CHI CHAY SAU KHI:
echo 1. V2.2 Hosting Preview bang Truong phong PTN da OK.
echo 2. Da bam Cau hinh Truong phong R&D cho Nguyen Ngoc Son tren trang PTN-R&D.
echo.
echo Rules V2.2 chi mo doc CASE CONG KHAI cho permission rnd.tech.overview.
echo Private handling khong duoc mo rong.
echo.
set "FB="
for /f "delims=" %%F in ('where firebase.cmd 2^>nul') do if not defined FB set "FB=%%F"
if not defined FB if exist "%APPDATA%\npm\firebase.cmd" set "FB=%APPDATA%\npm\firebase.cmd"
if not defined FB if exist "%USERPROFILE%\AppData\Roaming\npm\firebase.cmd" set "FB=%USERPROFILE%\AppData\Roaming\npm\firebase.cmd"
if not defined FB (echo ERROR: firebase.cmd not found.&pause&exit /b 10)
choice /C YN /M "Deploy Rules V2.2 de test Truong phong R&D?"
if errorlevel 2 exit /b 0
call "%FB%" deploy --only firestore:rules --project app-ptn-pccc --config "%~dp0firebase.rules.v2_2.json"
if errorlevel 1 (echo RULES DEPLOY FAILED.&pause&exit /b 20)
echo.
echo RULES V2.2 DEPLOYED. Test ngay Nguyen Ngoc Son va 5 tai khoan PTN.
echo Neu co loi quyen, chay 03_ROLLBACK_RULES_V2_1.cmd.
pause
'@
Set-Content (Join-Path $work '02_DEPLOY_RULES_V2_2_FOR_RND_HEAD_TEST.cmd') $rulesCmd -Encoding ASCII

$rollbackCmd = @'
@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title HUB-PTN - ROLLBACK RULES V2.1
cls
echo ==========================================================
echo EMERGENCY ROLLBACK - FIRESTORE RULES V2.1
echo ==========================================================
set "FB="
for /f "delims=" %%F in ('where firebase.cmd 2^>nul') do if not defined FB set "FB=%%F"
if not defined FB if exist "%APPDATA%\npm\firebase.cmd" set "FB=%APPDATA%\npm\firebase.cmd"
if not defined FB if exist "%USERPROFILE%\AppData\Roaming\npm\firebase.cmd" set "FB=%USERPROFILE%\AppData\Roaming\npm\firebase.cmd"
if not defined FB (echo ERROR: firebase.cmd not found.&pause&exit /b 10)
choice /C YN /M "Rollback Firestore Rules ve dung V2.1?"
if errorlevel 2 exit /b 0
call "%FB%" deploy --only firestore:rules --project app-ptn-pccc --config "%~dp0firebase.rules.rollback.v2_1.json"
if errorlevel 1 (echo ROLLBACK FAILED.&pause&exit /b 20)
echo RULES V2.1 RESTORED.
pause
'@
Set-Content (Join-Path $work '03_ROLLBACK_RULES_V2_1.cmd') $rollbackCmd -Encoding ASCII

$test = @'
HUB V2.2 - MA TRAN TEST

A. TRUONG PHONG PTN - TEST PREVIEW TRUOC RULES
1. F5, SSO Cong -> HUB, quay ve Cong.
2. Bang VM van hien tat ca case cu.
3. VM da chuyen R&D KHONG nam sai o Moi/Tiep nhan; hien "Cho R&D xu ly".
4. PTN <-> R&D hien VM dang o R&D (vi du VM-011 neu con currentDesk R&D).
5. Mo VM -> co muc PHAN HOI CUA BO PHAN XU LY.
6. Bao com, pin, private handling cu khong loi.
7. Tai trang PTN <-> R&D bam "Cau hinh Truong phong R&D" cho ngocson707@gmail.com.

B. SAU KHI A DAT - CHAY RULES V2.2
Chay 02_DEPLOY_RULES_V2_2_FOR_RND_HEAD_TEST.cmd.

C. NGUYEN NGOC SON - TRUONG PHONG R&D
1. Dang nhap ngocson707@gmail.com.
2. Vao Khong gian PTN: xem duoc tong quan CASE CONG KHAI PTN.
3. Khong thay private handling cua HCNS/KT/KHO/QLCL neu khong lien quan.
4. PTN <-> R&D hien case R&D.
5. Gui phan hoi: Dang xu ly.
6. Gui phan hoi: Can PTN bo sung thong tin.
7. Gui phan hoi: Da xu ly - cho PTN xac nhan.
8. Dien mo ta, ket qua ky thuat, de xuat.
9. Dinh kem anh/file nho; file lon dung link Drive/OneDrive.

D. PTN XAC NHAN
1. Truong phong PTN mo case R&D da phan hoi.
2. Chon Xac nhan hoan thanh -> case ve Da xu ly, nguon van con xem lich su.
3. Hoac Yeu cau bo sung -> case van o R&D va hien Cho R&D bo sung.

E. HOI QUY
Test lai: Do, Tuyen, Tu, Tuyen ca dem + bao com + pin + Menu Cong HFI.
'@
Set-Content (Join-Path $work 'MA_TRAN_TEST_HUB_V2_2.txt') $test -Encoding UTF8

# Static integrity checks.
$patched = Get-Content $index -Raw -Encoding UTF8
if ($patched -notmatch 'hub-v22\.js') { throw 'Injection JS V2.2 failed.' }
if ($patched -notmatch 'hub-v22\.css') { throw 'Injection CSS V2.2 failed.' }
if ($patched -notmatch 'Phiên bản V2\.2') { Write-Warning 'Khong thay dong version V2.2; module van duoc chen.' }

$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    & $node.Source --check (Join-Path $work 'public\hub-v22.js')
    if ($LASTEXITCODE -ne 0) { throw 'JavaScript V2.2 syntax check failed.' }
    Write-Host 'JavaScript syntax: OK' -ForegroundColor Green
} else {
    Write-Warning 'Node khong co trong PATH - bo qua node --check.'
}

$outZip = Join-Path (Split-Path -Parent $source.FullName) 'HUB_PTN_V2_2_INTERDEPT_PREVIEW.zip'
if (Test-Path $outZip) { Remove-Item $outZip -Force }
Compress-Archive -Path (Join-Path $work '*') -DestinationPath $outZip -CompressionLevel Optimal
Write-Host ('OUTPUT ZIP: ' + $outZip) -ForegroundColor Green

# Deploy Hosting Preview immediately from the derived working folder.
$fb = $null
try { $fb = (Get-Command firebase.cmd -ErrorAction Stop).Source } catch {}
if (-not $fb) {
    $try = @(
        (Join-Path $env:APPDATA 'npm\firebase.cmd'),
        (Join-Path $env:USERPROFILE 'AppData\Roaming\npm\firebase.cmd')
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    $fb = $try
}
if (-not $fb) { throw 'firebase.cmd not found. ZIP V2.2 da tao nhung Preview chua deploy.' }
$config = if (Test-Path (Join-Path $work 'firebase.hosting.json')) { 'firebase.hosting.json' } else { 'firebase.json' }
Push-Location $work
try {
    & $fb hosting:channel:deploy hub-v22-interdept --expires 30d --project app-ptn-pccc --config (Join-Path $work $config)
    if ($LASTEXITCODE -ne 0) { throw 'Firebase Hosting Preview deploy failed.' }
} finally {
    Pop-Location
}
Write-Host 'V2.2 PREVIEW DEPLOY COMPLETE. Production unchanged.' -ForegroundColor Green
