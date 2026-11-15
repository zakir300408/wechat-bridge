$ErrorActionPreference='Stop'
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /target:winexe ("/out:"+(Join-Path $PSScriptRoot 'Companion.exe')) /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll /reference:System.Security.dll (Join-Path $PSScriptRoot 'GatewayCompanion.cs')
if($LASTEXITCODE){throw 'Launcher compilation failed'}
$meta=Get-Content (Join-Path $PSScriptRoot 'package.json') -Raw | ConvertFrom-Json
$out=[IO.Path]::GetFullPath((Join-Path (Split-Path $PSScriptRoot) 'dist'))
New-Item -ItemType Directory -Force $out | Out-Null
$stage=[IO.Path]::GetFullPath((Join-Path $out ('stage-'+[Guid]::NewGuid().ToString('N'))))
if(!$stage.StartsWith($out+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid staging directory'}
New-Item -ItemType Directory -Path $stage | Out-Null
try{
 foreach($relative in (@('Install.cmd','package.json')+@($meta.files))){
  if([IO.Path]::IsPathRooted($relative) -or $relative -match '(^|[\\/])\.\.([\\/]|$)'){throw 'Unsafe package manifest path'}
  $source=Join-Path $PSScriptRoot $relative
  if(!(Test-Path -LiteralPath $source -PathType Leaf)){throw ('Missing runtime file: '+$relative)}
  $target=Join-Path $stage $relative
  New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force
 }
 $zip=Join-Path $out ('WeChatBridge-'+$meta.version+'-windows-x64.zip')
 Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -Force
 $hash=(Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash
 Set-Content -LiteralPath ($zip+'.sha256') -Value ($hash.ToLowerInvariant()+'  '+[IO.Path]::GetFileName($zip))
 Write-Host $zip
}finally{
 $resolvedStage=[IO.Path]::GetFullPath($stage)
 if($resolvedStage.StartsWith($out+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){
  Remove-Item -LiteralPath $resolvedStage -Recurse -Force
 }
}
