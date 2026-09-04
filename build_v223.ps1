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

$work=Join-Path $root '_HUB_V223_WORK'
if(Test-Path $work){Remove-Item $work -Recurse -Force}
New-Item -ItemType Directory -Path $work|Out-Null
Expand-Archive $source.FullName $work -Force
$index=Join-Path $work 'public\index.html'
if(-not(Test-Path $index)){throw 'ZIP nguon khong co public\index.html.'}

Copy-Item (Join-Path $root 'hub-v22.js') (Join-Path $work 'public\hub-v22.js') -Force
Copy-Item (Join-Path $root 'hub-v22.css') (Join-Path $work 'public\hub-v22.css') -Force
Copy-Item (Join-Path $root 'hub-v222-chat.js') (Join-Path $work 'public\hub-v222-chat.js') -Force
Copy-Item (Join-Path $root 'hub-v222-chat.css') (Join-Path $work 'public\hub-v222-chat.css') -Force
Copy-Item (Join-Path $root 'hub-v223-rndfix.js') (Join-Path $work 'public\hub-v223-rndfix.js') -Force

$html=Get-Content $index -Raw -Encoding UTF8
$html=$html -replace 'V2\.1\.1_ACCESS_SECURITY_COMPAT','V2.2.3_RND_FIX_PREVIEW'
$html=[regex]::Replace($html,'Phiên bản\s+V2\.(1\.1|2|2\.1|2\.2)\s*·\s*Tạo bởi Dương Đức Vượng','Phiên bản V2.2.3 · Tạo bởi Dương Đức Vượng')
if($html -notmatch 'hub-v22\.css'){$html=$html -replace '</head>',"  <link rel=`"stylesheet`" href=`"hub-v22.css?v=223`">`r`n</head>"}
if($html -notmatch 'hub-v222-chat\.css'){$html=$html -replace '</head>',"  <link rel=`"stylesheet`" href=`"hub-v222-chat.css?v=223`">`r`n</head>"}
if($html -notmatch 'hub-v22\.js'){$html=$html -replace '</body>',"  <script src=`"hub-v22.js?v=223`"></script>`r`n</body>"}
if($html -notmatch 'hub-v222-chat\.js'){$html=$html -replace '</body>',"  <script src=`"hub-v222-chat.js?v=223`"></script>`r`n</body>"}
if($html -notmatch 'hub-v223-rndfix\.js'){$html=$html -replace '</body>',"  <script src=`"hub-v223-rndfix.js?v=223`"></script>`r`n</body>"}
Set-Content $index $html -Encoding UTF8
Get-ChildItem $work -Filter '*.cmd' -File -ErrorAction SilentlyContinue|Remove-Item -Force

# Rules V2.2.3 candidate: explicit R&D response/chat permission + R&D head public case read + general chat.
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
    $addCase=$mCase.Value+"`r`n      // V2.2.3: Truong phong R&D duoc doc case cong khai; private_notes van theo rule rieng.`r`n      allow read: if activeMember() && hasPermission(`"rnd.tech.overview`");"
    $v22=$v21.Substring(0,$mCase.Index)+$addCase+$v21.Substring($mCase.Index+$mCase.Length)
    $mFallback=$rxFallback.Match($v22)
    if($mFallback.Success){
$extra=@'
    // HUB V2.2.3 - response/chat write compatibility. Only explicit operational roles.
    match /hub_comments/{commentId} {
      allow create: if activeMember() &&
        request.resource.data.userUid == request.auth.uid &&
        request.auth.token.email != null &&
        request.resource.data.userEmail == request.auth.token.email &&
        (
          (request.resource.data.type == "department_response" &&
            (isOwner() || role() == "head" || (role() == "rnd" && hasPermission("rnd.response.manage")))) ||
          (request.resource.data.type == "interdept_chat" &&
            (isOwner() || role() in ["head","lead3tr","leadkn","leadknnight","leadatas","rnd","coord","testeng"])) ||
          (request.resource.data.type == "case_attachment" &&
            (isOwner() || role() in ["head","lead3tr","leadkn","leadknnight","leadatas","rnd","coord","testeng"]))
        );
    }

    // HUB V2.2.3 - chat chung PTN <-> R&D. Append-only.
    match /hub_interdept_chat/{messageId} {
      allow read: if activeMember() &&
        (isOwner() || role() in ["head","lead3tr","leadkn","leadknnight","leadatas","rnd","coord","testeng"]);
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
      $v22=$v22.Substring(0,$mFallback.Index)+$extra+$v22.Substring($mFallback.Index)
      Set-Content (Join-Path $work 'firestore.rules.V2_2_3_CANDIDATE') $v22 -Encoding UTF8
      @{firestore=@{rules='firestore.rules.V2_2_3_CANDIDATE'}}|ConvertTo-Json -Depth 5|Set-Content (Join-Path $work 'firebase.rules.v2_2_3.json') -Encoding UTF8
      @{firestore=@{rules='firestore.rules.V2_1_ROLLBACK'}}|ConvertTo-Json -Depth 5|Set-Content (Join-Path $work 'firebase.rules.rollback.v2_1.json') -Encoding UTF8
      $rulesReady=$true
      Write-Host 'Rules V2.2.3 candidate: PREPARED (NOT DEPLOYED)' -ForegroundColor Green
    }else{Write-Warning 'Khong tim thay fallback match; Preview van chay, Rules candidate khong tao.'}
  }else{Write-Warning 'Khong tim thay match hub_cases; Preview van chay, Rules candidate khong tao.'}
}else{Write-Warning 'Khong tim thay Rules V2.1. Preview Hosting van tiep tuc.'}

$previewCmd=@'
@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title HUB-PTN V2.2.3 - PREVIEW
cls
echo HUB-PTN V2.2.3 - R&D RESPONSE + AUDIT FIX - PREVIEW ONLY
set "FB="
for /f "delims=" %%F in ('where firebase.cmd 2^>nul') do if not defined FB set "FB=%%F"
if not defined FB if exist "%APPDATA%\npm\firebase.cmd" set "FB=%APPDATA%\npm\firebase.cmd"
if not defined FB if exist "%USERPROFILE%\AppData\Roaming\npm\firebase.cmd" set "FB=%USERPROFILE%\AppData\Roaming\npm\firebase.cmd"
if not defined FB (echo ERROR: firebase.cmd not found.&pause&exit /b 10)
set "CFG=firebase.hosting.json"
if not exist "%CFG%" set "CFG=firebase.json"
call "%FB%" hosting:channel:deploy hub-v223-interdept --expires 30d --project app-ptn-pccc --config "%~dp0%CFG%"
if errorlevel 1 (echo PREVIEW FAILED. Production unchanged.&pause&exit /b 20)
echo HUB V2.2.3 PREVIEW COMPLETE. Production unchanged.
pause
'@
Set-Content (Join-Path $work '01_PREVIEW_HUB_V2_2_3_INTERDEPT.cmd') $previewCmd -Encoding ASCII

if($rulesReady){
$rulesCmd=@'
@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title HUB-PTN V2.2.3 - RULES R&D RESPONSE TEST
cls
echo ==========================================================
echo RULES V2.2.3 - R&D RESPONSE / CHAT TEST
 echo ==========================================================
echo Chi chay sau khi Hosting Preview V2.2.3 mo duoc binh thuong.
echo Muc dich: cho R&D gui phan hoi co truy vet + chat VM + chat chung.
echo Private handling KHONG mo rong.
set "FB="
for /f "delims=" %%F in ('where firebase.cmd 2^>nul') do if not defined FB set "FB=%%F"
if not defined FB if exist "%APPDATA%\npm\firebase.cmd" set "FB=%APPDATA%\npm\firebase.cmd"
if not defined FB (echo ERROR: firebase.cmd not found.&pause&exit /b 10)
choice /C YN /M "Deploy Rules V2.2.3 de test R&D response?"
if errorlevel 2 exit /b 0
call "%FB%" deploy --only firestore:rules --project app-ptn-pccc --config "%~dp0firebase.rules.v2_2_3.json"
if errorlevel 1 (echo RULES DEPLOY FAILED.&pause&exit /b 20)
echo RULES V2.2.3 DEPLOYED. Test ngay Nguyen Ngoc Son + Owner.
pause
'@
Set-Content (Join-Path $work '02_DEPLOY_RULES_V2_2_3_RND_RESPONSE_TEST.cmd') $rulesCmd -Encoding ASCII
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
HUB V2.2.3 - TEST LOI R&D
1. Dang nhap Nguyen Ngoc Son -> mo VM-011.
2. Audit trail KHONG con hien link "The query requires an index"; V2.2.3 tai theo caseId va sort tren trinh duyet.
3. Dien Phan hoi R&D + chon anh nho -> Gui phan hoi.
4. Neu Preview bao Rules chua cho phep -> chay 02_DEPLOY_RULES_V2_2_3_RND_RESPONSE_TEST.cmd roi thu lai.
5. Sau Rules: Gui phan hoi phai thanh cong, mo lai VM thay noi dung + file/anh + nguoi gui + thoi gian.
6. Thu chat thread VM-011 va Trao doi chung PTN-R&D.
7. Owner mo VM-011: nhin thay phan hoi R&D; neu R&D chon "Da xu ly - cho PTN xac nhan" thi Owner co nut Xac nhan hoan thanh / Yeu cau bo sung.
8. Private handling cua bo phan khac van khong mo cho R&D.
9. Test lai 5 tai khoan PTN, bao com, pin, Menu Cong HFI.
10. Chua Production V2.2.3 o buoc nay.
'@
Set-Content (Join-Path $work 'MA_TRAN_TEST_HUB_V2_2_3.txt') $test -Encoding UTF8

$patched=Get-Content $index -Raw -Encoding UTF8
foreach($needle in @('hub-v22.js','hub-v22.css','hub-v222-chat.js','hub-v222-chat.css','hub-v223-rndfix.js')){if($patched -notmatch [regex]::Escape($needle)){throw ('Injection failed: '+$needle)}}
$node=Get-Command node -ErrorAction SilentlyContinue
if($node){
  foreach($js in @('hub-v22.js','hub-v222-chat.js','hub-v223-rndfix.js')){& $node.Source --check (Join-Path $work ('public\'+$js));if($LASTEXITCODE -ne 0){throw ($js+' syntax failed.')}}
  Write-Host 'JavaScript syntax: OK (core + chat + R&D fix)' -ForegroundColor Green
}else{Write-Warning 'Node not found - skip syntax check.'}

$outZip=Join-Path (Split-Path -Parent $source.FullName) 'HUB_PTN_V2_2_3_RND_FIX_PREVIEW.zip'
if(Test-Path $outZip){Remove-Item $outZip -Force}
Compress-Archive -Path (Join-Path $work '*') -DestinationPath $outZip -CompressionLevel Optimal
Write-Host ('OUTPUT ZIP: '+$outZip) -ForegroundColor Green

$fb=$null
try{$fb=(Get-Command firebase.cmd -ErrorAction Stop).Source}catch{}
if(-not $fb){$fb=@((Join-Path $env:APPDATA 'npm\firebase.cmd'),(Join-Path $env:USERPROFILE 'AppData\Roaming\npm\firebase.cmd'))|Where-Object{Test-Path $_}|Select-Object -First 1}
if(-not $fb){throw 'firebase.cmd not found. ZIP da tao nhung Preview chua deploy.'}
$config=if(Test-Path (Join-Path $work 'firebase.hosting.json')){'firebase.hosting.json'}else{'firebase.json'}
Push-Location $work
try{& $fb hosting:channel:deploy hub-v223-interdept --expires 30d --project app-ptn-pccc --config (Join-Path $work $config);if($LASTEXITCODE -ne 0){throw 'Firebase Hosting Preview failed.'}}finally{Pop-Location}
Write-Host 'V2.2.3 PREVIEW DEPLOY COMPLETE. Production unchanged.' -ForegroundColor Green
