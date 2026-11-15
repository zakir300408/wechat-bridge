$ErrorActionPreference='Stop'
$fixture=Join-Path ([IO.Path]::GetTempPath()) ('wechat-bridge-test-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixture | Out-Null
$exe=Join-Path $fixture 'Companion.exe'
$log=Join-Path $fixture 'commands.log'
function Assert-True($condition,$message){if(!$condition){throw $message}}
function Wait-Until([scriptblock]$condition){
 $deadline=[DateTime]::UtcNow.AddSeconds(15)
 do {if(& $condition){return};Start-Sleep -Milliseconds 150}while([DateTime]::UtcNow -lt $deadline)
 throw 'Tray lifecycle check timed out'
}
try{
 Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Companion.exe') -Destination $exe
 @{node=(Get-Command node.exe).Source;weflowRoot=$fixture} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $fixture 'settings.json') -Encoding utf8
 @'
const fs=require('node:fs'),path=require('node:path');
const log=path.join(__dirname,'commands.log');
fs.appendFileSync(log,'started\n');
console.log('Connected. Synthetic test backend.');
process.stdin.setEncoding('utf8');
let pending='';
process.stdin.on('data', chunk=>{
 pending+=chunk;
 let index;
 while((index=pending.indexOf('\n'))>=0){
  const command=pending.slice(0,index).trim();pending=pending.slice(index+1);
  fs.appendFileSync(log,command+'\n');
  if(command==='stop')process.exit(0);
 }
});
'@ | Set-Content -LiteralPath (Join-Path $fixture 'connector.mjs') -Encoding utf8
 # The fake backend uses CommonJS, independent of the installed WeChat reader.
 $fake=Get-Content -LiteralPath (Join-Path $fixture 'connector.mjs') -Raw
 $fake=$fake.Replace("const fs=require('node:fs'),path=require('node:path');", "import fs from 'node:fs';import path from 'node:path';const __dirname=import.meta.dirname;")
 Set-Content -LiteralPath (Join-Path $fixture 'connector.mjs') -Value $fake -Encoding utf8
 $app=Start-Process -FilePath $exe -ArgumentList '--background' -WindowStyle Hidden -PassThru
 Wait-Until {Test-Path -LiteralPath $log}
 $app.Refresh();Assert-True ($app.MainWindowHandle -eq 0) 'Background startup opened a window'
 Assert-True ((Get-Content -LiteralPath $log) -notcontains 'open-page') 'Background startup opened the connection page'
 $duplicate=Start-Process -FilePath $exe -ArgumentList '--background' -WindowStyle Hidden -PassThru
 Assert-True ($duplicate.WaitForExit(5000)) 'Second launch did not exit'
 Assert-True (@(Get-Content -LiteralPath $log | Where-Object {$_ -eq 'started'}).Count -eq 1) 'Second launch started another reader'
 $page=Start-Process -FilePath $exe -ArgumentList '--page' -WindowStyle Hidden -PassThru
 Assert-True ($page.WaitForExit(5000)) 'Connection-page request did not exit'
 Wait-Until {(Get-Content -LiteralPath $log) -contains 'open-page'}
 $quit=Start-Process -FilePath $exe -ArgumentList '--quit' -WindowStyle Hidden -PassThru
 Assert-True ($quit.WaitForExit(5000)) 'Quit request did not exit'
 Assert-True ($app.WaitForExit(10000)) 'Tray process did not quit'
 Assert-True ((Get-Content -LiteralPath $log) -contains 'stop') 'Quit did not stop the owned reader'
 Write-Output 'Tray lifecycle passed: no window or browser on startup, one reader, connection-page request, graceful shutdown.'
}finally{
 $owned=@(Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -eq $exe})
 foreach($item in $owned){& taskkill.exe /PID $item.ProcessId /T /F | Out-Null}
 $resolved=[IO.Path]::GetFullPath($fixture)
 $temp=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
 if($resolved.StartsWith($temp,[StringComparison]::OrdinalIgnoreCase) -and [IO.Path]::GetFileName($resolved) -like 'wechat-bridge-test-*'){Remove-Item -LiteralPath $resolved -Recurse -Force}
}
