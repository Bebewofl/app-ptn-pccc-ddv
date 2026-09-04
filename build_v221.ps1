$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$downloads=Join-Path $env:USERPROFILE 'Downloads'
$searchDirs=@($root,(Split-Path -Parent $root),$downloads)|Where-Object{$_ -and (Test-Path $_)}|Select-Object -Unique
$candidates=@()
foreach($d in $searchDirs){
  $candidates+=Get-ChildItem $d -Filter 'HUB_PTN_V2_1_1_PRODUCTION_RULES_AND_ONBOARDING*.zip' -File -ErrorAction SilentlyContinue
  $candidates+=Get-ChildItem $d -Filter 'HUB_PTN_V2_1_1_ACCESS_SECURITY_COMPAT*.zip' -File -ErrorAction SilentlyContinue
}
$candidates=$candidates|Sort-Object LastWriteTime -Descending -Unique
if(-not $candidates){throw 'Khong tim thay ZIP HUB V2.1.1 trong thu muc hien tai/cha/Downloads.'}
$source=$candidates[0]
Write-Host ('SOURCE: '+$source.FullName) -ForegroundColor Cyan

$work=Join-Path $root '_HUB_V221_WORK'
if(Test-Path $work){Remove-Item $work -Recurse -Force}
New-Item -ItemType Directory -Path $work|Out-Null
Expand-Archive $source.FullName $work -Force
$index=Join-Path $work 'public\index.html'
if(-not(Test-Path $index)){throw 'ZIP nguon khong co public\index.html.'}
Copy-Item (Join-Path $root 'hub-v22.js') (Join-Path $work 'public\hub-v22.js') -Force
Copy-Item (Join-Path $root 'hub-v22.css') (Join-Path $work 'public\hub-v22.css') -Force

$html=Get-Content $index -Raw -Encoding UTF8
$html=$html -replace 'V2\.1\.1_ACCESS_SECURITY_COMPAT','V2.2.1_INTERDEPT_PREVIEW'
$html=[regex]::Replace($html,'Phiên bản\s+V2\.1\.1\s*·\s*Tạo bởi Dương Đức Vượng','Phiên bản V2.2.1 · Tạo bởi Dương Đức Vượng')
$html=[regex]::Replace($html,'Phiên bản\s+V2\.2\s*·\s*Tạo bởi Dương Đức Vượng','Phiên bản V2.2.1 · Tạo bởi Dương Đức Vượng')
if($html -notmatch 'hub-v22\.css'){$html=$html -replace '</head>',"  <link rel=`"stylesheet`" href=`"hub-v22.css?v=221`">`r`n</head>"}
if($html -notmatch 'hub-v22\.js'){$html=$html -replace '</body>',"  <script src=`"hub-v22.js?v=221`"></script>`r`n</body>"}
Set-Content $index $html -Encoding UTF8
Get-ChildItem $work -Filter '*.cmd' -File -ErrorAction SilentlyContinue|Remove-Item -Force

# Rules V2.2 candidate: only add public hub_cases read for explicit rnd.tech.overview permission.
$ruleCandidates=@((Join-Path $work 'firestore.rules.V2_1_PRODUCTION'),(Join-Path $work 'firestore.rules.V2_1_PROPOSED_NOT_DEPLOYED'),(Join-Path $work 'firestore.rules'))
$rulesSource=$ruleCandidates|Where-Object{Test-Path $_}|Select-Object -First 1
$rulesReady=$false
if($rulesSource){
  $v21=Get-Content $rulesSource -Raw -Encoding UTF8
  Set-Content (Join-Path $work 'firestore.rules.V2_1_ROLLBACK') $v21 -Encoding UTF8
  $rx=[regex]'match\s+/hub_cases/\{[^}]+\}\s*\{'
  $m=$rx.Match($v21)
  if($m.Success){
    $add=$m.Value+"`r`n      // HUB V2.2.1: Trưởng phòng R&D chỉ mở đọc case công khai; private_notes vẫn theo rule riêng.`r`n      allow read: if activeMember() && hasPermission(`"rnd.tech.overview`");"
    $v22=$v21.Substring(0,$m.Index)+$add+$v21.Substring($m.Index+$m.Length)
    Set-Content (Join-Path $work 'firestore.rules.V2_2_CANDIDATE') $v22 -Encoding UTF8
    @{firestore=@{rules='firestore.rules.V2_2_CANDIDATE'}}|ConvertTo-Json -Depth 5|Set-Content (Join-Path $work 'firebase.rules.v2_2.json') -Encoding UTF8
    @{firestore=@{rules='firestore.rules.V2_1_ROLLBACK'}}|ConvertTo-Json -Depth 5|Set-Content (Join-Path $work 'firebase.rules.rollback.v2_1.json') -Encoding UTF8
    $rulesReady=$true
    Write-Host 'Rules V2.2 candidate: PREPARED (NOT DEPLOYED)' -ForegroundColor Green
  }else{Write-Warning 'Khong nhan dien duoc match hub_cases. Preview van tiep tuc, Rules V2.2 khong duoc tao.'}
}else{Write-Warning 'Khong tim thay Rules V2.1. Preview Hosting van tiep tuc.'}

$previewCmd=@'
@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title HUB-PTN V2.2.1 - PREVIEW
cls
echo HUB-PTN V2.2.1 - PREVIEW ONLY
set "FB="
for /f "delims=" %%F in ('where firebase.cmd 2^>nul') do if not defined FB set "FB=%%F"
if not defined FB if exist "%APPDATA%\npm\firebase.cmd" set "FB=%APPDATA%\npm\firebase.cmd"
if not defined FB if exist "%USERPROFILE%\AppData\Roaming\npm\firebase.cmd" set "FB=%USERPROFILE%\AppData\Roaming\npm\firebase.cmd"
if not defined FB (echo ERROR: firebase.cmd not found.&pause&exit /b 10)
set "CFG=firebase.hosting.json"
if not exist "%CFG%" set "CFG=firebase.json"
call "%FB%" hosting:channel:deploy hub-v221-interdept --expires 30d --project app-ptn-pccc --config "%~dp0%CFG%"
if errorlevel 1 (echo PREVIEW FAILED. Production unchanged.&pause&exit /b 20)
echo HUB V2.2.1 PREVIEW COMPLETE. Production unchanged.
pause
'@
Set-Content (Join-Path $work '01_PREVIEW_HUB_V2_2_1_INTERDEPT.cmd') $previewCmd -Encoding ASCII

if($rulesReady){
$rulesCmd=@'
@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title HUB-PTN V2.2.1 - RULES TEST
cls
echo CHI CHAY SAU KHI HOSTING PREVIEW V2.2.1 DA OK.
echo Rules nay chi mo doc public hub_cases cho permission rnd.tech.overview.
echo Private handling khong mo rong.
set "FB="
for /f "delims=" %%F in ('where firebase.cmd 2^>nul') do if not defined FB set "FB=%%F"
if not defined FB if exist "%APPDATA%\npm\firebase.cmd" set "FB=%APPDATA%\npm\firebase.cmd"
if not defined FB (echo ERROR: firebase.cmd not found.&pause&exit /b 10)
choice /C YN /M "Deploy Rules V2.2 de test Truong phong R&D?"
if errorlevel 2 exit /b 0
call "%FB%" deploy --only firestore:rules --project app-ptn-pccc --config "%~dp0firebase.rules.v2_2.json"
if errorlevel 1 (echo RULES DEPLOY FAILED.&pause&exit /b 20)
echo RULES V2.2 DEPLOYED. Test ngay Nguyen Ngoc Son va 5 tai khoan PTN.
pause
'@
Set-Content (Join-Path $work '02_DEPLOY_RULES_V2_2_FOR_RND_HEAD_TEST.cmd') $rulesCmd -Encoding ASCII
$rollback=@'
@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title HUB-PTN - ROLLBACK RULES V2.1
set "FB="
for /f "delims=" %%F in ('where firebase.cmd 2^>nul') do if not defined FB set "FB=%%F"
if not defined FB if exist "%APPDATA%\npm\firebase.cmd" set "FB=%APPDATA%\npm\firebase.cmd"
if not defined FB (echo ERROR: firebase.cmd not found.&pause&exit /b 10)
choice /C YN /M "Rollback Rules ve V2.1?"
if errorlevel 2 exit /b 0
call "%FB%" deploy --only firestore:rules --project app-ptn-pccc --config "%~dp0firebase.rules.rollback.v2_1.json"
if errorlevel 1 (echo ROLLBACK FAILED.&pause&exit /b 20)
echo RULES V2.1 RESTORED.
pause
'@
Set-Content (Join-Path $work '03_ROLLBACK_RULES_V2_1.cmd') $rollback -Encoding ASCII
}

$test=@'
HUB V2.2.1 - TEST NHANH
1. Bang PTN: cot la Moi/Tiep nhan | Dang xu ly | Cho phan hoi/xac nhan | Da xu ly/Dong.
2. VM-011 da chuyen R&D phai hien Cho R&D tiep nhan; khong bien mat khoi bang PTN.
3. PTN-R&D KHONG con Tong quan vuong mac cong khai PTN.
4. PTN-R&D chi co: Cho tiep nhan; Dang xu ly/phoi hop; Cho xac nhan; Da xu ly/Lich su.
5. Mo VM-011: co Phan hoi bo phan xu ly + Chat nhanh.
6. Form Tao ban ghi: co file/anh/video + chon thu muc + link Drive/OneDrive.
7. Tao VM test co anh/file nho -> mo lai case va thay muc Tep/anh/tai lieu khi bao cao.
8. Chat nhanh gui duoc; ket luan van phai ghi o Phan hoi chinh thuc.
9. Chua deploy Rules V2.2 truoc khi Owner test 1-8 dat.
'@
Set-Content (Join-Path $work 'MA_TRAN_TEST_HUB_V2_2_1.txt') $test -Encoding UTF8

$patched=Get-Content $index -Raw -Encoding UTF8
if($patched -notmatch 'hub-v22\.js'){throw 'Injection JS failed.'}
if($patched -notmatch 'hub-v22\.css'){throw 'Injection CSS failed.'}
$node=Get-Command node -ErrorAction SilentlyContinue
if($node){& $node.Source --check (Join-Path $work 'public\hub-v22.js');if($LASTEXITCODE -ne 0){throw 'JavaScript V2.2.1 syntax failed.'};Write-Host 'JavaScript syntax: OK' -ForegroundColor Green}else{Write-Warning 'Node not found - skip syntax check.'}

$outZip=Join-Path (Split-Path -Parent $source.FullName) 'HUB_PTN_V2_2_1_INTERDEPT_PREVIEW.zip'
if(Test-Path $outZip){Remove-Item $outZip -Force}
Compress-Archive -Path (Join-Path $work '*') -DestinationPath $outZip -CompressionLevel Optimal
Write-Host ('OUTPUT ZIP: '+$outZip) -ForegroundColor Green

$fb=$null
try{$fb=(Get-Command firebase.cmd -ErrorAction Stop).Source}catch{}
if(-not $fb){$fb=@((Join-Path $env:APPDATA 'npm\firebase.cmd'),(Join-Path $env:USERPROFILE 'AppData\Roaming\npm\firebase.cmd'))|Where-Object{Test-Path $_}|Select-Object -First 1}
if(-not $fb){throw 'firebase.cmd not found. ZIP da tao nhung Preview chua deploy.'}
$config=if(Test-Path (Join-Path $work 'firebase.hosting.json')){'firebase.hosting.json'}else{'firebase.json'}
Push-Location $work
try{& $fb hosting:channel:deploy hub-v221-interdept --expires 30d --project app-ptn-pccc --config (Join-Path $work $config);if($LASTEXITCODE -ne 0){throw 'Firebase Hosting Preview failed.'}}finally{Pop-Location}
Write-Host 'V2.2.1 PREVIEW DEPLOY COMPLETE. Production unchanged.' -ForegroundColor Green
