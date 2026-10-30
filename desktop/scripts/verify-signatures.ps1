# Verifies Authenticode signatures of Windows build outputs. Exits non-zero (failing the build) on any problem.
# Usage: pwsh scripts/verify-signatures.ps1 -Path dist -Publisher "Your Company" [-Require]
#   -Require   fail if anything is unsigned (use for releases). Without it, unsigned files only produce warnings.
param([string]$Path = 'dist', [string]$Publisher = '', [switch]$Require)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Path -PathType Container)) { throw "Path '$Path' is not an existing directory (run from the folder that contains it, and pass named parameters: -Path dist)." }
$files = Get-ChildItem $Path -Recurse -Include *.exe, *.dll, *.node -File |
  Where-Object { $_.FullName -notmatch '\\(node_modules|resources\\app)\\' -or $_.Extension -ne '.dll' }
if (-not $files) { throw "No binaries found under $Path" }
$bad = @(); $unsigned = @(); $thirdParty = @()
$isOwn = { param($f, $cert) ($f.Name -match '^(Asta|Uninstall Asta|__uninstaller)') -or ($Publisher -and $cert -and $cert.Subject -match [regex]::Escape($Publisher)) }
foreach ($f in $files) {
  if ($f.FullName -match 'prebuilds[\\/](darwin|linux)') { continue }   # other-platform binaries are never loaded by Windows
  $sig = Get-AuthenticodeSignature $f.FullName
  if ($sig.Status -eq 'NotSigned') { $unsigned += $f.FullName; continue }
  $why = @()
  if ($sig.Status -ne 'Valid') { $why += "status $($sig.Status): $($sig.StatusMessage)" }
  if (-not $sig.TimeStamperCertificate) { $why += 'no RFC 3161 timestamp' }
  $cert = $sig.SignerCertificate
  if ($cert) {
    if ($Publisher -and $cert.Subject -notmatch [regex]::Escape($Publisher)) { $why += "publisher '$($cert.Subject)' does not match '$Publisher'" }
    if ($cert.SignatureAlgorithm.FriendlyName -notmatch 'sha256|sha384|sha512') { $why += "weak signature algorithm $($cert.SignatureAlgorithm.FriendlyName)" }
    $chain = New-Object Security.Cryptography.X509Certificates.X509Chain
    if (-not $chain.Build($cert)) { $why += 'certificate chain does not build to a trusted root' }
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
Write-Host "Signature verification passed ($($files.Count - $unsigned.Count) signed, $($unsigned.Count) unsigned)."
