$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$request=[Console]::In.ReadToEnd() | ConvertFrom-Json
function CleanLabel([string]$value,[int]$max){$clean=[regex]::Replace($value,'[\p{Cc}\p{Cf}]',' ');return $clean.Substring(0,[Math]::Min($clean.Length,$max))}
$app=CleanLabel ([string]$request.client_name) 80
$destination=CleanLabel ([string]$request.redirect_origin) 250
$form=New-Object System.Windows.Forms.Form
$form.Text='WeChat Companion - Allow access?'
$form.Size=New-Object System.Drawing.Size(600,350)
$form.StartPosition='CenterScreen';$form.FormBorderStyle='FixedDialog';$form.MaximizeBox=$false;$form.MinimizeBox=$false;$form.TopMost=$true
$label=New-Object System.Windows.Forms.Label
$label.SetBounds(22,20,540,220)
$label.Font=New-Object System.Drawing.Font('Segoe UI',11)
$label.Text="Allow read-only WeChat access on this PC?`r`n`r`nRequesting app: $app`r`nDestination: $destination`r`n`r`nThis grants access to local messages and supported attachments while the companion runs. You can disconnect or revoke access later."
$form.Controls.Add($label)
$allow=New-Object System.Windows.Forms.Button
$allow.Text='Allow read-only access';$allow.SetBounds(22,255,245,38);$allow.DialogResult=[System.Windows.Forms.DialogResult]::Yes;$form.Controls.Add($allow)
$deny=New-Object System.Windows.Forms.Button
$deny.Text='Deny';$deny.SetBounds(285,255,245,38);$deny.DialogResult=[System.Windows.Forms.DialogResult]::No;$form.Controls.Add($deny)
$form.AcceptButton=$deny;$form.CancelButton=$deny
$result=$form.ShowDialog()
[Console]::Out.Write($(if($result -eq [System.Windows.Forms.DialogResult]::Yes){'allow'}else{'deny'}))
$form.Dispose()
