$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$work=Join-Path $root '_HUB_V224_WORK'
if(-not(Test-Path $work)){throw 'Khong tim thay _HUB_V224_WORK. Hay chay build_v224.ps1 truoc.'}
$index=Join-Path $work 'public\index.html'
if(-not(Test-Path $index)){throw 'Khong tim thay public\index.html trong work V2.2.4.'}

# FIX2: use bounded/safe version updater. FIX1 used a characterData observer
# that could repeatedly write the same text and freeze the page.
Copy-Item (Join-Path $root 'hub-v224-versionfix2.js') (Join-Path $work 'public\hub-v224-versionfix2.js') -Force
$html=Get-Content $index -Raw -Encoding UTF8
$html=[regex]::Replace($html,'Phiên bản\s+V\d+(?:\.\d+)*','Phiên bản V2.2.4')
if($html -notmatch 'hub-v224-versionfix2\.js'){
  $html=$html -replace '</body>',"  <script src=`"hub-v224-versionfix2.js?v=224fix2`"></script>`r`n</body>"
}
Set-Content $index $html -Encoding UTF8

$node=Get-Command node -ErrorAction SilentlyContinue
if($node){
  & $node.Source --check (Join-Path $work 'public\hub-v224-versionfix2.js')
  if($LASTEXITCODE -ne 0){throw 'hub-v224-versionfix2.js syntax failed.'}
  Write-Host 'Version FIX2 JavaScript syntax: OK' -ForegroundColor Green
}

$downloads=Join-Path $env:USERPROFILE 'Downloads'
$outZip=Join-Path $downloads 'HUB_PTN_V2_2_4_CHAT_SYNC_PREVIEW.zip'
if(Test-Path $outZip){Remove-Item $outZip -Force}
Compress-Archive -Path (Join-Path $work '*') -DestinationPath $outZip -CompressionLevel Optimal
Write-Host ('OUTPUT ZIP UPDATED: '+$outZip) -ForegroundColor Green

# Redeploy SAME preview channel only. Production remains unchanged.
$fb=$null
try{$fb=(Get-Command firebase.cmd -ErrorAction Stop).Source}catch{}
if(-not $fb){$fb=@((Join-Path $env:APPDATA 'npm\firebase.cmd'),(Join-Path $env:USERPROFILE 'AppData\Roaming\npm\firebase.cmd'))|Where-Object{Test-Path $_}|Select-Object -First 1}
if(-not $fb){throw 'firebase.cmd not found. ZIP da cap nhat nhung Preview chua redeploy.'}
$config=if(Test-Path (Join-Path $work 'firebase.hosting.json')){'firebase.hosting.json'}else{'firebase.json'}
Push-Location $work
try{
  & $fb hosting:channel:deploy hub-v224-interdept --expires 30d --project app-ptn-pccc --config (Join-Path $work $config)
  if($LASTEXITCODE -ne 0){throw 'Firebase Hosting Preview redeploy failed.'}
}finally{Pop-Location}
Write-Host 'VISIBLE VERSION FIX2 DEPLOYED: HUB V2.2.4. Production unchanged.' -ForegroundColor Green
