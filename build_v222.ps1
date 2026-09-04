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

$work=Join-Path $root '_HUB_V222_WORK'
if(Test-Path $work){Remove-Item $work -Recurse -Force}
New-Item -ItemType Directory -Path $work|Out-Null
Expand-Archive $source.FullName $work -Force
$index=Join-Path $work 'public\index.html'
if(-not(Test-Path $index)){throw 'ZIP nguon khong co public\index.html.'}

Copy-Item (Join-Path $root 'hub-v22.js') (Join-Path $work 'public\hub-v22.js') -Force
Copy-Item (Join-Path $root 'hub-v22.css') (Join-Path $work 'public\hub-v22.css') -Force
Copy-Item (Join-Path $root 'hub-v222-chat.js') (Join-Path $work 'public\hub-v222-chat.js') -Force
Copy-Item (Join-Path $root 'hub-v222-chat.css') (Join-Path $work 'public\hub-v222-chat.css') -Force

$html=Get-Content $index -Raw -Encoding UTF8
$html=$html -replace 'V2\.1\.1_ACCESS_SECURITY_COMPAT','V2.2.2_INTERDEPT_PREVIEW'
$html=[regex]::Replace($html,'Phiên bản\s+V2\.(1\.1|2|2\.1)\s*·\s*Tạo bởi Dương Đức Vượng','Phiên bản V2.2.2 · Tạo bởi Dương Đức Vượng')
if($html -notmatch 'hub-v22\.css'){$html=$html -replace '</head>',"  <link rel=`"stylesheet`" href=`"hub-v22.css?v=222`">`r`n</head>"}
if($html -notmatch 'hub-v222-chat\.css'){$html=$html -replace '</head>',"  <link rel=`"stylesheet`" href=`"hub-v222-chat.css?v=222`">`r`n</head>"}
if($html -notmatch 'hub-v22\.js'){$html=$html -replace '</body>',"  <script src=`"hub-v22.js?v=222`"></script>`r`n</body>"}
if($html -notmatch 'hub-v222-chat\.js'){$html=$html -replace '</body>',"  <script src=`"hub-v222-chat.js?v=222`"></script>`r`n</body>"}
Set-Content $index $html -Encoding UTF8
Get-ChildItem $work -Filter '*.cmd' -File -ErrorAction SilentlyContinue|Remove-Item -Force

# Rules V2.2.2 candidate. Preview never deploys Rules automatically.
$ruleCandidates=@((Join-Path $work 'firestore.rules.V2_1_PRODUCTION'),(Join-Path $work 'firestore.rules.V2_1_PROPOSED_NOT_DEPLOYED'),(Join-Path $work 'firestore.rules'))
$rulesSource=$ruleCandidates|Where-Object{Test-Path $_}|Select-Object -First 1
$rulesReady=$false
if($rulesSource){
  $v21=Get-Content $rulesSource -Raw -Encoding UTF8
  Set-Content (Join-Path $work 'firestore.rules.V2_1_ROLLBACK') $v21 -Encoding UTF8
  $rxCase=[regex]'match\s+/hub_cases/\{[^}]+\}\s*\{'
  $mCase=$rxCase.Match($v21)
  if($mCase.Success){
    $addCase=$mCase.Value+"`r`n      // HUB V2.2.2: Truong phong R&D doc case cong khai. private_notes van theo rule rieng.`r`n      allow read: if activeMember() && hasPermission(`"rnd.tech.overview`");"
    $v22=$v21.Substring(0,$mCase.Index)+$addCase+$v21.Substring($mCase.Index+$mCase.Length)

    $rxFallback=[regex]'match\s+/\{document=\*\*\}\s*\{'
    $mFallback=$rxFallback.Match($v22)
    if($mFallback.Success){
      $chatRule=@'
    // HUB V2.2.2 - chat chung PTN <-> R&D. Tin nhan chi them moi, khong sua/xoa.
    match /hub_interdept_chat/{messageId} {
      allow read: if activeMember() && (
        isOwner() || role() in ["head","lead3tr","leadkn","leadknnight","leadatas","rnd","coord","testeng"]
      );
      allow create: if activeMember() &&
        (isOwner() || role() in ["head","lead3tr","leadkn","leadknnight","leadatas","rnd","coord","testeng"]) &&
        request.resource.data.spaceKey == "PTN-RD" &&
        request.resource.data.threadKey == "GENERAL" &&
        request.resource.data.userUid == request.auth.uid &&
        request.auth.token.email != null &&
        request.resource.data.userEmail == request.auth.token.email;
      allow update, delete: if false;
    }

'@
      $v22=$v22.Substring(0,$mFallback.Index)+$chatRule+$v22.Substring($mFallback.Index)
      Set-Content (Join-Path $work 'firestore.rules.V2_2_2_CANDIDATE') $v22 -Encoding UTF8
      @{firestore=@{rules='firestore.rules.V2_2_2_CANDIDATE'}}|ConvertTo-Json -Depth 5|Set-Content (Join-Path $work 'firebase.rules.v2_2_2.json') -Encoding UTF8
      @{firestore=@{rules='firestore.rules.V2_1_ROLLBACK'}}|ConvertTo-Json -Depth 5|Set-Content (Join-Path $work 'firebase.rules.rollback.v2_1.json') -Encoding UTF8
      $rulesReady=$true
      Write-Host 'Rules V2.2.2 candidate: PREPARED (NOT DEPLOYED)' -ForegroundColor Green
    }else{Write-Warning 'Khong tim thay fallback match {document=**}; Preview van chay, Rules V2.2.2 khong duoc tao.'}
  }else{Write-Warning 'Khong tim thay match hub_cases; Preview van chay, Rules V2.2.2 khong duoc tao.'}
}else{Write-Warning 'Khong tim thay Rules V2.1. Preview Hosting van tiep tuc.'}

$previewCmd=@'
@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title HUB-PTN V2.2.2 - PREVIEW
cls
echo HUB-PTN V2.2.2 - FIXED THREADED CHAT - PREVIEW ONLY
set "FB="
for /f "delims=" %%F in ('where firebase.cmd 2^>nul') do if not defined FB set "FB=%%F"
if not defined FB if exist "%APPDATA%\npm\firebase.cmd" set "FB=%APPDATA%\npm\firebase.cmd"
if not defined FB if exist "%USERPROFILE%\AppData\Roaming\npm\firebase.cmd" set "FB=%USERPROFILE%\AppData\Roaming\npm\firebase.cmd"
if not defined FB (echo ERROR: firebase.cmd not found.&pause&exit /b 10)
set "CFG=firebase.hosting.json"
if not exist "%CFG%" set "CFG=firebase.json"
call "%FB%" hosting:channel:deploy hub-v222-interdept --expires 30d --project app-ptn-pccc --config "%~dp0%CFG%"
if errorlevel 1 (echo PREVIEW FAILED. Production unchanged.&pause&exit /b 20)
echo HUB V2.2.2 PREVIEW COMPLETE. Production unchanged.
pause
'@
Set-Content (Join-Path $work '01_PREVIEW_HUB_V2_2_2_INTERDEPT.cmd') $previewCmd -Encoding ASCII

if($rulesReady){
$rulesCmd=@'
@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title HUB-PTN V2.2.2 - RULES TEST
cls
echo ==========================================================
echo RULES V2.2.2 - R&D HEAD + CHAT CHUNG PTN-R&D
 echo ==========================================================
echo CHI CHAY SAU KHI HOSTING PREVIEW V2.2.2 BANG OWNER DA OK.
echo Rules nay:
echo - mo doc public hub_cases cho rnd.tech.overview;
echo - mo chat chung PTN-R&D cho vai tro quan ly/ky thuat;
echo - KHONG mo private handling.
set "FB="
for /f "delims=" %%F in ('where firebase.cmd 2^>nul') do if not defined FB set "FB=%%F"
if not defined FB if exist "%APPDATA%\npm\firebase.cmd" set "FB=%APPDATA%\npm\firebase.cmd"
if not defined FB (echo ERROR: firebase.cmd not found.&pause&exit /b 10)
choice /C YN /M "Deploy Rules V2.2.2 de test Nguyen Ngoc Son?"
if errorlevel 2 exit /b 0
call "%FB%" deploy --only firestore:rules --project app-ptn-pccc --config "%~dp0firebase.rules.v2_2_2.json"
if errorlevel 1 (echo RULES DEPLOY FAILED.&pause&exit /b 20)
echo RULES V2.2.2 DEPLOYED. Test ngay Nguyen Ngoc Son va 5 tai khoan PTN.
pause
'@
Set-Content (Join-Path $work '02_DEPLOY_RULES_V2_2_2_FOR_RND_HEAD_TEST.cmd') $rulesCmd -Encoding ASCII
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
HUB V2.2.2 - TEST CHAT CO DINH + THREAD VM
1. PTN-R&D: ben phai co 1 panel co dinh "Trao doi nhanh PTN <-> R&D".
2. Drawer chi tiet VM KHONG con box chat rieng.
3. Dropdown chat co "Trao doi chung" + danh sach VM lien quan PTN-R&D (vi du VM-011).
4. Bam VM-011 tren danh sach -> chat tu dong chuyen sang thread VM-011.
5. Gui chat thread VM-011 -> luu/real-time dung VM, khong lan VM khac.
6. Owner gui duoc Trao doi chung trong Preview. R&D dung Trao doi chung sau khi Rules V2.2.2 duoc deploy.
7. Nut "Gan vao phan hoi" chi hien khi tai khoan dang la bo phan chiu trach nhiem phan hoi VM; bam nut -> mo VM va dien noi dung chat vao Mo ta phan hoi, KHONG tu dong ket luan.
8. Ket luan ky thuat van phai bam Gui phan hoi co truy vet.
9. File/anh/video/thu muc trong form Tao ban ghi va file/link trong Phan hoi van hoat dong nhu V2.2.1.
10. Production V2.1.1 va Rules hien tai khong thay doi trong buoc Preview.
'@
Set-Content (Join-Path $work 'MA_TRAN_TEST_HUB_V2_2_2.txt') $test -Encoding UTF8

$patched=Get-Content $index -Raw -Encoding UTF8
foreach($needle in @('hub-v22.js','hub-v22.css','hub-v222-chat.js','hub-v222-chat.css')){if($patched -notmatch [regex]::Escape($needle)){throw ('Injection failed: '+$needle)}}
$node=Get-Command node -ErrorAction SilentlyContinue
if($node){
  & $node.Source --check (Join-Path $work 'public\hub-v22.js');if($LASTEXITCODE -ne 0){throw 'hub-v22.js syntax failed.'}
  & $node.Source --check (Join-Path $work 'public\hub-v222-chat.js');if($LASTEXITCODE -ne 0){throw 'hub-v222-chat.js syntax failed.'}
  Write-Host 'JavaScript syntax: OK (core + fixed chat)' -ForegroundColor Green
}else{Write-Warning 'Node not found - skip syntax check.'}

$outZip=Join-Path (Split-Path -Parent $source.FullName) 'HUB_PTN_V2_2_2_INTERDEPT_PREVIEW.zip'
if(Test-Path $outZip){Remove-Item $outZip -Force}
Compress-Archive -Path (Join-Path $work '*') -DestinationPath $outZip -CompressionLevel Optimal
Write-Host ('OUTPUT ZIP: '+$outZip) -ForegroundColor Green

$fb=$null
try{$fb=(Get-Command firebase.cmd -ErrorAction Stop).Source}catch{}
if(-not $fb){$fb=@((Join-Path $env:APPDATA 'npm\firebase.cmd'),(Join-Path $env:USERPROFILE 'AppData\Roaming\npm\firebase.cmd'))|Where-Object{Test-Path $_}|Select-Object -First 1}
if(-not $fb){throw 'firebase.cmd not found. ZIP da tao nhung Preview chua deploy.'}
$config=if(Test-Path (Join-Path $work 'firebase.hosting.json')){'firebase.hosting.json'}else{'firebase.json'}
Push-Location $work
try{& $fb hosting:channel:deploy hub-v222-interdept --expires 30d --project app-ptn-pccc --config (Join-Path $work $config);if($LASTEXITCODE -ne 0){throw 'Firebase Hosting Preview failed.'}}finally{Pop-Location}
Write-Host 'V2.2.2 PREVIEW DEPLOY COMPLETE. Production unchanged.' -ForegroundColor Green
