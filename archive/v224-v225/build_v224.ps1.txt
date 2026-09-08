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

$work=Join-Path $root '_HUB_V224_WORK'
if(Test-Path $work){Remove-Item $work -Recurse -Force}
New-Item -ItemType Directory -Path $work|Out-Null
Expand-Archive $source.FullName $work -Force
$index=Join-Path $work 'public\index.html'
if(-not(Test-Path $index)){throw 'ZIP nguon khong co public\index.html.'}

Copy-Item (Join-Path $root 'hub-v22.js') (Join-Path $work 'public\hub-v22.js') -Force
Copy-Item (Join-Path $root 'hub-v22.css') (Join-Path $work 'public\hub-v22.css') -Force
Copy-Item (Join-Path $root 'hub-v222-chat.css') (Join-Path $work 'public\hub-v222-chat.css') -Force
Copy-Item (Join-Path $root 'hub-v223-rndfix.js') (Join-Path $work 'public\hub-v223-rndfix.js') -Force
Copy-Item (Join-Path $root 'hub-v224-chat.js') (Join-Path $work 'public\hub-v224-chat.js') -Force

$html=Get-Content $index -Raw -Encoding UTF8
$html=$html -replace 'V2\.1\.1_ACCESS_SECURITY_COMPAT','V2.2.4_CHAT_SYNC_PREVIEW'
$html=[regex]::Replace($html,'Phiên bản\s+V2\.(1\.1|2|2\.1|2\.2|2\.3)\s*·\s*Tạo bởi Dương Đức Vượng','Phiên bản V2.2.4 · Tạo bởi Dương Đức Vượng')
if($html -notmatch 'hub-v22\.css'){$html=$html -replace '</head>',"  <link rel=`"stylesheet`" href=`"hub-v22.css?v=224`">`r`n</head>"}
if($html -notmatch 'hub-v222-chat\.css'){$html=$html -replace '</head>',"  <link rel=`"stylesheet`" href=`"hub-v222-chat.css?v=224`">`r`n</head>"}
if($html -notmatch 'hub-v22\.js'){$html=$html -replace '</body>',"  <script src=`"hub-v22.js?v=224`"></script>`r`n</body>"}
if($html -notmatch 'hub-v223-rndfix\.js'){$html=$html -replace '</body>',"  <script src=`"hub-v223-rndfix.js?v=224`"></script>`r`n</body>"}
if($html -notmatch 'hub-v224-chat\.js'){$html=$html -replace '</body>',"  <script src=`"hub-v224-chat.js?v=224`"></script>`r`n</body>"}
Set-Content $index $html -Encoding UTF8
Get-ChildItem $work -Filter '*.cmd' -File -ErrorAction SilentlyContinue|Remove-Item -Force

# Rules V2.2.4: response fix from V2.2.3 + a single dedicated two-way chat channel.
$ruleCandidates=@((Join-Path $work 'firestore.rules.V2_1_PRODUCTION'),(Join-Path $work 'firestore.rules.V2_1_PROPOSED_NOT_DEPLOYED'),(Join-Path $work 'firestore.rules'))
$rulesSource=$ruleCandidates|Where-Object{Test-Path $_}|Select-Object -First 1
$rulesReady=$false
if($rulesSource){
  $v21=Get-Content $rulesSource -Raw -Encoding UTF8
  Set-Content (Join-Path $work 'firestore.rules.V2_1_ROLLBACK') $v21 -Encoding UTF8
  $rxCase=[regex]'match\s+/hub_cases/\{[^}]+\}\s*\{'
  $mCase=$rxCase.Match($v21)
  $rxFallback=[regex]'match\s+/\{document=\*\*\}\s*\{'
  if($mCase.Success){
    $addCase=$mCase.Value+"`r`n      // V2.2.4: Truong phong R&D doc case cong khai; private_notes van theo rule rieng.`r`n      allow read: if activeMember() && hasPermission(`"rnd.tech.overview`");"
    $v22=$v21.Substring(0,$mCase.Index)+$addCase+$v21.Substring($mCase.Index+$mCase.Length)
    $mFallback=$rxFallback.Match($v22)
    if($mFallback.Success){
$extra=@'
    // HUB V2.2.4 - official response / attachment compatibility.
    match /hub_comments/{commentId} {
      allow create: if activeMember() &&
        request.resource.data.userUid == request.auth.uid &&
        request.auth.token.email != null &&
        request.resource.data.userEmail == request.auth.token.email &&
        (
          (request.resource.data.type == "department_response" &&
            (isOwner() || role() == "head" || (role() == "rnd" && hasPermission("rnd.response.manage")))) ||
          (request.resource.data.type == "case_attachment" &&
            (isOwner() || role() in ["head","lead3tr","leadkn","leadknnight","leadatas","rnd","coord","testeng"])) ||
          (request.resource.data.type == "interdept_chat" &&
            (isOwner() || role() in ["head","lead3tr","leadkn","leadknnight","leadatas","rnd","coord","testeng"]))
        );
    }

    // HUB V2.2.4 - ONE realtime chat store for both GENERAL and VM threads.
    // Append-only. Query must include spaceKey == PTN-RD; thread filtering happens client-side.
    match /hub_interdept_chat/{messageId} {
      allow read: if activeMember() &&
        resource.data.spaceKey == "PTN-RD" &&
        (isOwner() || role() in ["head","lead3tr","leadkn","leadknnight","leadatas","rnd","coord","testeng"]);
      allow create: if activeMember() &&
        (isOwner() || role() in ["head","lead3tr","leadkn","leadknnight","leadatas","rnd","coord","testeng"]) &&
        request.resource.data.spaceKey == "PTN-RD" &&
        request.resource.data.threadKey is string &&
        request.resource.data.userUid == request.auth.uid &&
        request.auth.token.email != null &&
        request.resource.data.userEmail == request.auth.token.email &&
        request.resource.data.type == "interdept_chat";
      allow update, delete: if false;
    }

'@
      $v22=$v22.Substring(0,$mFallback.Index)+$extra+$v22.Substring($mFallback.Index)
      Set-Content (Join-Path $work 'firestore.rules.V2_2_4_CANDIDATE') $v22 -Encoding UTF8
      @{firestore=@{rules='firestore.rules.V2_2_4_CANDIDATE'}}|ConvertTo-Json -Depth 5|Set-Content (Join-Path $work 'firebase.rules.v2_2_4.json') -Encoding UTF8
      @{firestore=@{rules='firestore.rules.V2_1_ROLLBACK'}}|ConvertTo-Json -Depth 5|Set-Content (Join-Path $work 'firebase.rules.rollback.v2_1.json') -Encoding UTF8
      $rulesReady=$true
      Write-Host 'Rules V2.2.4 candidate: PREPARED (NOT DEPLOYED)' -ForegroundColor Green
    }else{Write-Warning 'Khong tim thay fallback match; Preview van chay, Rules candidate khong tao.'}
  }else{Write-Warning 'Khong tim thay match hub_cases; Preview van chay, Rules candidate khong tao.'}
}else{Write-Warning 'Khong tim thay Rules V2.1. Preview Hosting van tiep tuc.'}

$previewCmd=@'
@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title HUB-PTN V2.2.4 - PREVIEW
cls
echo HUB-PTN V2.2.4 - CHAT TWO-WAY SYNC FIX - PREVIEW ONLY
set "FB="
for /f "delims=" %%F in ('where firebase.cmd 2^>nul') do if not defined FB set "FB=%%F"
if not defined FB if exist "%APPDATA%\npm\firebase.cmd" set "FB=%APPDATA%\npm\firebase.cmd"
if not defined FB if exist "%USERPROFILE%\AppData\Roaming\npm\firebase.cmd" set "FB=%USERPROFILE%\AppData\Roaming\npm\firebase.cmd"
if not defined FB (echo ERROR: firebase.cmd not found.&pause&exit /b 10)
set "CFG=firebase.hosting.json"
if not exist "%CFG%" set "CFG=firebase.json"
call "%FB%" hosting:channel:deploy hub-v224-interdept --expires 30d --project app-ptn-pccc --config "%~dp0%CFG%"
if errorlevel 1 (echo PREVIEW FAILED. Production unchanged.&pause&exit /b 20)
echo HUB V2.2.4 PREVIEW COMPLETE. Production unchanged.
pause
'@
Set-Content (Join-Path $work '01_PREVIEW_HUB_V2_2_4_INTERDEPT.cmd') $previewCmd -Encoding ASCII

if($rulesReady){
$rulesCmd=@'
@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title HUB-PTN V2.2.4 - RULES CHAT SYNC TEST
cls
echo ==========================================================
echo RULES V2.2.4 - TWO-WAY PTN-R&D CHAT TEST
 echo ==========================================================
echo Chi chay sau khi Hosting Preview V2.2.4 mo binh thuong.
echo Muc dich: PTN gui -> R&D nhan realtime va R&D gui -> PTN nhan realtime.
echo Response V2.2.3 van duoc bao toan. Private handling KHONG mo rong.
set "FB="
for /f "delims=" %%F in ('where firebase.cmd 2^>nul') do if not defined FB set "FB=%%F"
if not defined FB if exist "%APPDATA%\npm\firebase.cmd" set "FB=%APPDATA%\npm\firebase.cmd"
if not defined FB (echo ERROR: firebase.cmd not found.&pause&exit /b 10)
choice /C YN /M "Deploy Rules V2.2.4 de test chat hai chieu?"
if errorlevel 2 exit /b 0
call "%FB%" deploy --only firestore:rules --project app-ptn-pccc --config "%~dp0firebase.rules.v2_2_4.json"
if errorlevel 1 (echo RULES DEPLOY FAILED.&pause&exit /b 20)
echo RULES V2.2.4 DEPLOYED. Test PTN va R&D dong thoi tren VM-011.
pause
'@
Set-Content (Join-Path $work '02_DEPLOY_RULES_V2_2_4_CHAT_SYNC_TEST.cmd') $rulesCmd -Encoding ASCII
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
HUB V2.2.4 - TEST CHAT HAI CHIEU PTN <-> R&D
1. Mo Preview V2.2.4 tren 2 may/tai khoan cung luc: Truong phong PTN va Nguyen Ngoc Son.
2. Ca hai vao PTN <-> R&D, chon thread VM-011.
3. PTN gui: "PTN test chat 224" -> R&D phai thay realtime ma khong F5.
4. R&D gui: "R&D da nhan chat 224" -> PTN phai thay realtime ma khong F5.
5. Chuyen sang Trao doi chung -> gui 2 chieu, tin VM-011 khong duoc lan sang General.
6. Quay lai VM-011 -> lich su chat cu V2.2.2/2.2.3 van co neu doc duoc; tin moi V2.2.4 luu trong hub_interdept_chat.
7. R&D phan hoi "Can PTN bo sung thong tin" van hoat dong; Owner van doc duoc response/audit.
8. Khong co composite-index warning.
9. Private handling cua bo phan khac khong mo cho R&D.
10. Chua Production V2.2.4 o buoc nay.
'@
Set-Content (Join-Path $work 'MA_TRAN_TEST_HUB_V2_2_4.txt') $test -Encoding UTF8

$patched=Get-Content $index -Raw -Encoding UTF8
foreach($needle in @('hub-v22.js','hub-v22.css','hub-v222-chat.css','hub-v223-rndfix.js','hub-v224-chat.js')){if($patched -notmatch [regex]::Escape($needle)){throw ('Injection failed: '+$needle)}}
$node=Get-Command node -ErrorAction SilentlyContinue
if($node){
  foreach($js in @('hub-v22.js','hub-v223-rndfix.js','hub-v224-chat.js')){& $node.Source --check (Join-Path $work ('public\'+$js));if($LASTEXITCODE -ne 0){throw ($js+' syntax failed.')}}
  Write-Host 'JavaScript syntax: OK (core + R&D response fix + chat sync fix)' -ForegroundColor Green
}else{Write-Warning 'Node not found - skip syntax check.'}

$outZip=Join-Path (Split-Path -Parent $source.FullName) 'HUB_PTN_V2_2_4_CHAT_SYNC_PREVIEW.zip'
if(Test-Path $outZip){Remove-Item $outZip -Force}
Compress-Archive -Path (Join-Path $work '*') -DestinationPath $outZip -CompressionLevel Optimal
Write-Host ('OUTPUT ZIP: '+$outZip) -ForegroundColor Green

$fb=$null
try{$fb=(Get-Command firebase.cmd -ErrorAction Stop).Source}catch{}
if(-not $fb){$fb=@((Join-Path $env:APPDATA 'npm\firebase.cmd'),(Join-Path $env:USERPROFILE 'AppData\Roaming\npm\firebase.cmd'))|Where-Object{Test-Path $_}|Select-Object -First 1}
if(-not $fb){throw 'firebase.cmd not found. ZIP da tao nhung Preview chua deploy.'}
$config=if(Test-Path (Join-Path $work 'firebase.hosting.json')){'firebase.hosting.json'}else{'firebase.json'}
Push-Location $work
try{& $fb hosting:channel:deploy hub-v224-interdept --expires 30d --project app-ptn-pccc --config (Join-Path $work $config);if($LASTEXITCODE -ne 0){throw 'Firebase Hosting Preview failed.'}}finally{Pop-Location}
Write-Host 'V2.2.4 PREVIEW DEPLOY COMPLETE. Production unchanged.' -ForegroundColor Green
