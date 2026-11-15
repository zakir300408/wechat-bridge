param([Parameter(Mandatory=$true)][string]$Owner)
$ErrorActionPreference='Stop'
if($Owner -notmatch '^[a-z0-9][a-z0-9._-]*$'){throw 'Use your npm username or organization name, without @.'}
$p=Join-Path $PSScriptRoot 'package.json'
$meta=Get-Content -LiteralPath $p -Raw | ConvertFrom-Json
$meta.name='@'+$Owner+'/wechat-companion'
$meta.private=$false
$meta | Add-Member -NotePropertyName publishConfig -NotePropertyValue @{access='public';registry='https://registry.npmjs.org/'} -Force
$meta | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $p -Encoding utf8
Push-Location $PSScriptRoot
try {
 $json=& npm.cmd pack --dry-run --json --ignore-scripts
 if($LASTEXITCODE){throw 'Package inspection failed'}
 $pack=$json | ConvertFrom-Json
 $allowed=@('package.json','cli.cjs','Companion.exe','Install.ps1','server.mjs','extract.py','requirements.txt','requirements-backend.txt','README.md','LICENSE','connector.mjs','credentials.ps1','consent.ps1','contacts.py','contact-resolution.mjs','attachments.mjs','media.py','image_quality.py','backend/package.json','backend/package-lock.json')
 foreach($f in $pack[0].files){if($f.path -notin $allowed){throw ('Unexpected published file: '+$f.path)}}
 Write-Host ('Prepared '+$meta.name+'@'+$meta.version)
 Write-Host 'Only application files are included. No account data, keys or local configuration.'
 Write-Host 'Nothing was published. Review and test the package before npm publish --access public.'
} finally {Pop-Location}
