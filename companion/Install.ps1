param([switch]$NoLaunch)
$ErrorActionPreference='Stop'
$dest=Join-Path $env:LOCALAPPDATA 'WeChatCompanion'
New-Item -ItemType Directory -Force $dest | Out-Null
# Stop this installation before replacing its files. WeChat itself stays running.
$installedExe=Join-Path $dest 'Companion.exe'
$apps=@(Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -eq $installedExe})
if($apps.Count){
 $sha=[Security.Cryptography.SHA256]::Create()
 try{$identity=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(($dest+'\').ToUpperInvariant())))).Replace('-','').Substring(0,24)}finally{$sha.Dispose()}
 try{$quit=[Threading.EventWaitHandle]::OpenExisting('Local\WeChatBridge-'+$identity+'-quit');$quit.Set() | Out-Null;$quit.Dispose()}catch{}
 foreach($app in $apps){
  $process=Get-Process -Id $app.ProcessId -ErrorAction SilentlyContinue
  if($process -and !$process.WaitForExit(8000)){& taskkill.exe /PID $app.ProcessId /T /F | Out-Null}
 }
}
foreach($f in @('server.mjs','extract.py','Companion.exe','README.md','connector.mjs','credentials.ps1','consent.ps1','contacts.py','contact-resolution.mjs','attachments.mjs','media.py','image_quality.py','LICENSE')) {Copy-Item -LiteralPath (Join-Path $PSScriptRoot $f) -Destination (Join-Path $dest $f) -Force}
$node=Get-Command node.exe -ErrorAction SilentlyContinue
if(!$node){
 Write-Host 'Installing a private Node.js runtime...'
 $release=Invoke-RestMethod 'https://nodejs.org/dist/index.json' | Where-Object {$_.lts -and $_.files -contains 'win-x64-zip'} | Select-Object -First 1
 $name="node-$($release.version)-win-x64.zip"; $url="https://nodejs.org/dist/$($release.version)"
 $zip=Join-Path $dest $name
 Invoke-WebRequest "$url/$name" -OutFile $zip
 $hashes=(Invoke-WebRequest "$url/SHASUMS256.txt").Content
 $expected=($hashes -split "`n" | Where-Object {$_ -match " $([regex]::Escape($name))$"}).Split(' ')[0]
 if(!$expected -or (Get-FileHash $zip -Algorithm SHA256).Hash -ne $expected){throw 'Node download checksum mismatch'}
 Expand-Archive -LiteralPath $zip -DestinationPath $dest -Force
 $node=Get-Item (Join-Path $dest "node-$($release.version)-win-x64\node.exe")
}
$nodePath=if($node.Source){$node.Source}else{$node.FullName}
$env:PATH=(Split-Path $nodePath)+';'+$env:PATH
$pythonCandidates=@((Join-Path $env:USERPROFILE '.weflow-cli\venv\Scripts\python.exe'),(Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'))
$python=$pythonCandidates | Where-Object {Test-Path -LiteralPath $_} | Select-Object -First 1
if(!$python){
 if(!(Get-Command winget.exe -ErrorAction SilentlyContinue)){throw 'Python 3.12 is needed. Install it from python.org, then rerun Install.'}
 winget.exe install --id Python.Python.3.12 --exact --scope user --silent --accept-package-agreements --accept-source-agreements
 $python=Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'
 if(!(Test-Path $python)){throw 'Python installation needs completion; rerun Install after it finishes.'}
}
$backend=Join-Path $dest 'backend'
New-Item -ItemType Directory -Force $backend | Out-Null
foreach($manifest in @('package.json','package-lock.json')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot ('backend\'+$manifest)) -Destination (Join-Path $backend $manifest) -Force}
Write-Host 'Installing the locked WeFlow reader and transport dependencies...'
$npm=Join-Path (Split-Path $nodePath) 'npm.cmd'
& $npm ci --prefix $backend --registry=https://registry.npmjs.org --ignore-scripts --omit=optional --no-audit --no-fund
if($LASTEXITCODE){throw 'Locked reader installation failed'}
$weflow=Join-Path $backend 'node_modules\weflow-cli'
if(!(Test-Path (Join-Path $env:USERPROFILE '.weflow-cli\venv\Scripts\python.exe'))){
 & $python -m venv (Join-Path $env:USERPROFILE '.weflow-cli\venv')
 $python=Join-Path $env:USERPROFILE '.weflow-cli\venv\Scripts\python.exe'
}
 & $python -m pip install -r (Join-Path $PSScriptRoot 'requirements-backend.txt') --disable-pip-version-check
 if($LASTEXITCODE){throw 'WeFlow Python dependencies failed'}
$extractPython=Join-Path $dest 'extract-env\Scripts\python.exe'
if(!(Test-Path $extractPython)){& $python -m venv (Join-Path $dest 'extract-env')}
& $extractPython -m pip install -r (Join-Path $PSScriptRoot 'requirements.txt') --disable-pip-version-check
if($LASTEXITCODE){throw 'Attachment extraction dependencies failed'}
$settings=Join-Path $dest 'settings.json'
if(!(Test-Path $settings)){
 @{node=$nodePath;weflowRoot=$weflow;python=$extractPython;deviceName=$env:COMPUTERNAME} | ConvertTo-Json | Set-Content -LiteralPath $settings -Encoding UTF8
}else{
 $existingSettings=Get-Content -LiteralPath $settings -Raw | ConvertFrom-Json
 $existingSettings.node=$nodePath;$existingSettings.weflowRoot=$weflow;$existingSettings.python=$extractPython
 $existingSettings | ConvertTo-Json | Set-Content -LiteralPath $settings -Encoding UTF8
}
$shell=New-Object -ComObject WScript.Shell
$shortcut=$shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'WeChat Bridge.lnk'))
$shortcut.TargetPath=Join-Path $dest 'Companion.exe';$shortcut.WorkingDirectory=$dest;$shortcut.Save()
$startupDir=[Environment]::GetFolderPath('Startup')
$legacyStartup=Join-Path $startupDir 'WeChatCompanion.cmd'
if(Test-Path -LiteralPath $legacyStartup){Remove-Item -LiteralPath $legacyStartup}
$preferenceFile=Join-Path $dest 'startup-preference.json'
$startAtLogin=$true
if(Test-Path -LiteralPath $preferenceFile){$startAtLogin=(Get-Content -LiteralPath $preferenceFile -Raw | ConvertFrom-Json).enabled -eq $true}
if($startAtLogin){
 $startupShortcut=$shell.CreateShortcut((Join-Path $startupDir 'WeChatBridge.lnk'))
 $startupShortcut.TargetPath=$installedExe;$startupShortcut.Arguments='--background';$startupShortcut.WorkingDirectory=$dest;$startupShortcut.Save()
}
@{enabled=$startAtLogin} | ConvertTo-Json | Set-Content -LiteralPath $preferenceFile -Encoding utf8
if(!$NoLaunch){Start-Process -FilePath $installedExe -ArgumentList '--setup' -WindowStyle Hidden}
Write-Host 'Installed. WeChat Bridge runs in the system tray. Double-click its icon to open your connection page.'
