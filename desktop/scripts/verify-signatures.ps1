# Verifies Authenticode signatures of Windows build outputs. Exits non-zero (failing the build) on any problem.
# Usage: pwsh scripts/verify-signatures.ps1 -Path dist -Publisher "Your Company" [-Require]
#   -Require   fail if anything is unsigned (use for releases). Without it, unsigned files only produce warnings.
#   -SigntoolStrict  also run `signtool verify /pa /all /v` on our own binaries (installers, Asta.exe, uninstaller); fails if signtool is missing.
#   Always prints SHA-256 of every installer (Asta-Setup-*.exe) and writes dist/SHA256-INSTALLERS.txt.
param([string]$Path = 'dist', [string]$Publisher = '', [switch]$Require, [switch]$SigntoolStrict)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Path -PathType Container)) { throw "Path '$Path' is not an existing directory (run from the folder that contains it, and pass named parameters: -Path dist)." }
$files = Get-ChildItem $Path -Recurse -Include *.exe, *.dll, *.node -File |
  Where-Object { $_.FullName -notmatch '\\(node_modules|resources\\app)\\' -or $_.Extension -ne '.dll' }
if (-not $files) { throw "No binaries found under $Path" }
$signtool = $null
if ($Require -or $SigntoolStrict) {
  $signtool = (Get-Command signtool.exe -ErrorAction SilentlyContinue).Source
  if (-not $signtool) {
    $roots = @("${env:ProgramFiles(x86)}\Windows Kits\10\bin", "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign")
    $signtool = $roots | Where-Object { $_ -and (Test-Path $_) } | ForEach-Object { Get-ChildItem $_ -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue } |
      Where-Object { $_.FullName -match 'x64' } | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
  }
  if (-not $signtool) { Write-Error 'signtool.exe not found (install the Windows SDK); cannot run the strict verification.'; exit 1 }
}
$bad = @(); $unsigned = @(); $thirdParty = @()
$isOwn = { param($f, $cert) ($f.Name -match '^(Asta|Uninstall Asta|__uninstaller)') -or ($Publisher -and $cert -and $cert.Subject -match [regex]::Escape($Publisher)) }
foreach ($f in $files) {
  if ($f.FullName -match 'prebuilds[\\/](darwin|linux)') { continue }   # other-platform binaries are never loaded by Windows
  $sig = Get-AuthenticodeSignature $f.FullName
  if ($sig.Status -eq 'NotSigned') { $unsigned += $f.FullName; continue }
  $why = @()
  if ($sig.Status -ne 'Valid') { $why += "status $($sig.Status): $($sig.StatusMessage)" }
  if (-not $sig.TimeStamperCertificate) { $why += 'no RFC 3161 timestamp (signature would expire with the certificate)' }
  $cert = $sig.SignerCertificate
  if ($cert) {
    if ($Publisher -and $cert.Subject -notmatch [regex]::Escape($Publisher)) { $why += "publisher '$($cert.Subject)' does not match '$Publisher'" }
    if ($cert.SignatureAlgorithm.FriendlyName -notmatch 'sha256|sha384|sha512') { $why += "weak signature algorithm $($cert.SignatureAlgorithm.FriendlyName)" }
    $chain = New-Object Security.Cryptography.X509Certificates.X509Chain
    if (-not $chain.Build($cert)) { $why += 'certificate chain does not build to a trusted root' }
  }
  if ($signtool -and (& $isOwn $f $cert) -and -not $why) {
    $out = & $signtool verify /pa /all /v $f.FullName 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { $why += "signtool verify /pa /all failed: $(($out -split "`n" | Select-Object -Last 6) -join ' ')" }
  }
  if ($why -and -not (& $isOwn $f $cert)) { $thirdParty += "$($f.FullName): $($why -join '; ')" }
  elseif ($why) { $bad += "$($f.FullName): $($why -join '; ')" } else { Write-Host "OK  $($f.Name)  [$($cert.Subject)]" }
}
# Native addons (.node) are signed too (win.signExts); only other-platform prebuilds (never loaded on Windows) are exempt.
$must = $unsigned | Where-Object { $_ -notmatch 'prebuilds[\\/](darwin|linux)' }
if ($thirdParty) { Write-Warning "$($thirdParty.Count) bundled third-party file(s) with signature notes (not ours):`n  $($thirdParty -join "`n  ")" }
if ($unsigned) { Write-Warning "$($unsigned.Count) unsigned file(s):`n  $($unsigned -join "`n  ")" }
if ($bad) { Write-Error "Signature verification FAILED:`n$($bad -join "`n")"; exit 1 }
if ($Require -and $must) { Write-Error "Release requires signed binaries but found unsigned files (see warning above)."; exit 1 }
$setups = Get-ChildItem $Path -Filter 'Asta-Setup-*.exe' -File -ErrorAction SilentlyContinue
if ($Require -and -not $setups) { Write-Error 'No Asta-Setup-*.exe installer found to verify.'; exit 1 }
if ($setups) {
  $lines = $setups | Get-FileHash -Algorithm SHA256 | ForEach-Object { '{0}  {1}' -f $_.Hash.ToLower(), (Split-Path $_.Path -Leaf) }
  $lines | Set-Content (Join-Path $Path 'SHA256-INSTALLERS.txt') -Encoding ascii
  Write-Host ($lines -join "`n")
}
Write-Host "Signature verification passed ($($files.Count - $unsigned.Count) signed, $($unsigned.Count) unsigned)."
