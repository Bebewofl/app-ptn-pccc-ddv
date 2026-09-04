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
    $html = $html -replace '</head>', "  <link rel=`"stylesheet`" href=`"hub-v22.css?v=221`">`r`n</head>"
}
if ($html -notmatch 'hub-v22\.js') {
    $html = $html -replace '</body>', "  <script src=`"hub-v22.js?v=221`"></script>`r`n</body>"
}
Set-Content -Path $index -Value $html -Encoding UTF8

# Remove every old deployment script from the derived package.
Get-ChildItem $work -Filter '*.cmd' -File -ErrorAction SilentlyContinue | Remove-Item -Force

# Preserve exact V2.1 Rules. Rules V2.2 are prepared separately, but never deployed during Preview.
$ruleCandidates = @(
    (Join-Path $work 'firestore.rules.V2_1_PRODUCTION'),
    (Join-Path $work 'firestore.rules.V2_1_PROPOSED_NOT_DEPLOYED'),
    (Join-Path $work 'firestore.rules')
)
$rulesSource = $ruleCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$rulesReady = $false
if ($rulesSource) {
    $rulesV21 = Get-Content $rulesSource -Raw -Encoding UTF8
    Set-Content (Join-Path $work 'firestore.rules.V2_1_ROLLBACK') $rulesV21 -Encoding UTF8

    # FIX1: do not depend on the exact helper/function formatting in the source Rules.
    # Firestore ORs multiple allow read statements. Add one narrowly-scoped read rule
    # inside hub_cases for accounts explicitly granted rnd.tech.overview.
    $rxCase = [regex]'match\s+/hub_cases/\{[^}]+\}\s*\{'
    $mCase = $rxCase.Match($rulesV21)
    if ($mCase.Success) {
        $addition = $mCase.Value + "`r`n      // HUB V2.2 - Trưởng phòng R&D: chỉ mở đọc case công khai; private_notes có rules riêng và không bị mở.`r`n      allow read: if activeMember() && hasPermission(`"rnd.tech.overview`");"
        $rulesV22 = $rulesV21.Substring(0,$mCase.Index) + $addition + $rulesV21.Substring($mCase.Index + $mCase.Length)
        Set-Content (Join-Path $work 'firestore.rules.V2_2_CANDIDATE') $rulesV22 -Encoding UTF8
        @{ firestore = @{ rules = 'firestore.rules.V2_2_CANDIDATE' } } | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $work 'firebase.rules.v2_2.json') -Encoding UTF8
        @{ firestore = @{ rules = 'firestore.rules.V2_1_ROLLBACK' } } | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $work 'firebase.rules.rollback.v2_1.json') -Encoding UTF8
        $rulesReady = $true
        Write-Host 'Rules V2.2 candidate: PREPARED (NOT DEPLOYED)' -ForegroundColor Green
    } else {
        Write-Warning 'Khong nhan dien duoc match /hub_cases trong Rules nguon. Preview van tiep tuc; Rules V2.2 se KHONG duoc tao/deploy.'
        Set-Content (Join-Path $work 'RULES_V2_2_CHUA_TAO.txt') 'Preview V2.2 van dung Rules V2.1. Khong co script deploy Rules V2.2 trong goi nay.' -Encoding UTF8
    }
} else {
    Write-Warning 'Khong tim thay Rules V2.1 trong ZIP nguon. Preview Hosting van tiep tuc va khong cham Rules.'
    Set-Content (Join-Path $work 'RULES_V2_2_CHUA_TAO.txt') 'Preview V2.2 van chay Hosting-only. Khong tim thay Rules nguon nen khong tao Rules V2.2.' -Encoding UTF8
}

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
echo Test Owner first. Rules V2.1 production remain unchanged.
pause
'@
Set-Content (Join-Path $work '01_PREVIEW_HUB_V2_2_INTERDEPT.cmd') $previewCmd -Encoding ASCII

if ($rulesReady) {
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
echo CHI CHAY SAU KHI HOSTING PREVIEW V2.2 BANG TRUONG PHONG PTN DA OK.
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
}

$test = @'
HUB V2.2 - TEST PREVIEW
1. Cổng -> HUB, F5, quay về Cổng.
2. VM chuyển R&D không biến mất khỏi bảng nguồn; hiển thị Chờ R&D xử lý.
3. PTN <-> R&D phải hiện VM đang ở R&D.
4. Mở VM phải có PHẢN HỒI CỦA BỘ PHẬN XỬ LÝ.
5. Báo cơm / pin / private handling cũ không lỗi.
6. Chưa chạy Rules V2.2 khi 5 bước trên chưa đạt.
7. Sau khi Owner đạt, mới cấu hình Nguyễn Ngọc Sơn và test Rules V2.2 nếu gói có Step 02.
'@
Set-Content (Join-Path $work 'MA_TRAN_TEST_HUB_V2_2.txt') $test -Encoding UTF8

$patched = Get-Content $index -Raw -Encoding UTF8
if ($patched -notmatch 'hub-v22\.js') { throw 'Injection JS V2.2 failed.' }
if ($patched -notmatch 'hub-v22\.css') { throw 'Injection CSS V2.2 failed.' }

$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    & $node.Source --check (Join-Path $work 'public\hub-v22.js')
    if ($LASTEXITCODE -ne 0) { throw 'JavaScript V2.2 syntax check failed.' }
    Write-Host 'JavaScript syntax: OK' -ForegroundColor Green
} else { Write-Warning 'Node khong co trong PATH - bo qua node --check.' }

$outZip = Join-Path (Split-Path -Parent $source.FullName) 'HUB_PTN_V2_2_INTERDEPT_PREVIEW.zip'
if (Test-Path $outZip) { Remove-Item $outZip -Force }
Compress-Archive -Path (Join-Path $work '*') -DestinationPath $outZip -CompressionLevel Optimal
Write-Host ('OUTPUT ZIP: ' + $outZip) -ForegroundColor Green

$fb = $null
try { $fb = (Get-Command firebase.cmd -ErrorAction Stop).Source } catch {}
if (-not $fb) {
    $fb = @((Join-Path $env:APPDATA 'npm\firebase.cmd'),(Join-Path $env:USERPROFILE 'AppData\Roaming\npm\firebase.cmd')) | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $fb) { throw 'firebase.cmd not found. ZIP V2.2 da tao nhung Preview chua deploy.' }
$config = if (Test-Path (Join-Path $work 'firebase.hosting.json')) { 'firebase.hosting.json' } else { 'firebase.json' }
Push-Location $work
try {
    & $fb hosting:channel:deploy hub-v22-interdept --expires 30d --project app-ptn-pccc --config (Join-Path $work $config)
    if ($LASTEXITCODE -ne 0) { throw 'Firebase Hosting Preview deploy failed.' }
} finally { Pop-Location }
Write-Host 'V2.2 PREVIEW DEPLOY COMPLETE. Production unchanged.' -ForegroundColor Green
