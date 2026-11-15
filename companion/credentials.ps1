param([ValidateSet('protect','unprotect')][string]$Mode)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
$value=[Console]::In.ReadToEnd()
if($Mode -eq 'protect'){
 $protected=[Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($value),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 [Console]::Out.Write([Convert]::ToBase64String($protected))
}else{
 $plain=[Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($value),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 [Console]::Out.Write([Text.Encoding]::UTF8.GetString($plain))
}
