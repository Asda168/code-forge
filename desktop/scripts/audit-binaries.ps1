# Audits every executable component (exe/dll/node/sys/ocx/msi + installers) under a folder and writes:
#   <Out>/signature-audit.csv|.md   per-file: path, type, publisher, status, issuer, timestamp, SHA-256, origin, expected-signed
#   <Out>/SHA256-MANIFEST.txt       sha256sum-compatible manifest of every file under -Path (detects later modification)
# With -Compare <manifest> it verifies the tree against an earlier manifest (modified/missing/extra files fail).
# Usage: pwsh scripts/audit-binaries.ps1 -Path dist -Out dist/audit [-Publisher "Name"] [-Compare old.txt]
# Read-only: it never signs or changes anything. Third-party files are reported, never "trusted" without a Valid signature.
param([string]$Path = 'dist', [string]$Out = 'audit', [string]$Publisher = '', [string]$Compare = '')
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Path -PathType Container)) { throw "Path '$Path' is not a directory." }
$root = (Resolve-Path $Path).Path.TrimEnd('\')
New-Item -ItemType Directory -Force $Out | Out-Null
$rel = { param($p) $p.Substring($root.Length + 1).Replace('\', '/') }

# Where a file comes from decides whether *we* are expected to sign it.
$origin = {
  param($r)
  switch -Regex ($r) {
    '(^|/)(Asta|Uninstall Asta|__uninstaller|old-uninstaller)\.exe$|^Asta-Setup.*\.exe$' { 'asta-own'; break }
    'node-pty/third_party/conpty/|node-pty/.*/conpty/(conpty\.dll|OpenConsole\.exe)$|d3dcompiler_47\.dll$' { 'microsoft-redistributable'; break }
    'prebuilds/(darwin|linux)' { 'other-platform (never loaded on Windows)'; break }
    'node-pty/' { 'npm:node-pty'; break }
    '(^|/)(ffmpeg|libEGL|libGLESv2|vk_swiftshader|vulkan-1)\.dll$|swiftshader/' { 'electron/chromium'; break }
    'elevate\.exe$' { 'electron-builder (NSIS helper)'; break }
    default { 'unknown' }
  }
}
$expectSigned = {
  param($r, $org, $ext)
  if ($org -like 'other-platform*') { return 'no (not a Windows binary)' }
  if ($org -eq 'microsoft-redistributable') { return 'yes (by Microsoft; must stay Microsoft-signed)' }
  if ($org -eq 'unknown') { return 'investigate' }
  return 'yes (loaded by Windows; SAC blocks unsigned)'
}

$exts = '.exe', '.dll', '.node', '.sys', '.ocx', '.msi', '.scr', '.cpl'
$bins = Get-ChildItem -LiteralPath $root -Recurse -File | Where-Object { $exts -contains $_.Extension.ToLower() }
$rows = foreach ($f in $bins) {
  $r = & $rel $f.FullName
  $sig = Get-AuthenticodeSignature -LiteralPath $f.FullName
  $c = $sig.SignerCertificate
  $org = & $origin $r
  $chainOk = ''
  if ($c) { $ch = New-Object Security.Cryptography.X509Certificates.X509Chain; $chainOk = $ch.Build($c) }
  [pscustomobject]@{
    File = $r; Type = $f.Extension.TrimStart('.').ToLower(); SizeBytes = $f.Length
    Status = $sig.Status.ToString()
    Publisher = $(if ($c) { ($c.Subject -replace '.*?CN=([^,]+).*', '$1') } else { '' })
    Issuer = $(if ($c) { ($c.Issuer -replace '.*?CN=([^,]+).*', '$1') } else { '' })
    SigAlgorithm = $(if ($c) { $c.SignatureAlgorithm.FriendlyName } else { '' })
    Timestamped = [bool]$sig.TimeStamperCertificate
    ChainTrusted = $chainOk
    SHA256 = (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash.ToLower()
    Origin = $org
    ExpectedSigned = (& $expectSigned $r $org $f.Extension)
    PublisherMatches = $(if ($Publisher -and $c) { $c.Subject -match [regex]::Escape($Publisher) } else { '' })
  }
}
$rows | Sort-Object File | Export-Csv "$Out/signature-audit.csv" -NoTypeInformation -Encoding utf8

$md = @("# Signature audit", "", "Root: ``$Path``  |  files: $($rows.Count)  |  generated: $(Get-Date -Format s)", "",
  "| File | Type | Status | Publisher | Issuer | TS | Origin | Expected signed |", "|---|---|---|---|---|---|---|---|")
$md += $rows | Sort-Object File | ForEach-Object { "| $($_.File) | $($_.Type) | $($_.Status) | $($_.Publisher) | $($_.Issuer) | $($_.Timestamped) | $($_.Origin) | $($_.ExpectedSigned) |" }
$md | Set-Content "$Out/signature-audit.md" -Encoding utf8

# Manifest over every file (not just binaries) so any modification is detectable. Relative paths, sha256sum format.
$manifest = Get-ChildItem -LiteralPath $root -Recurse -File | Where-Object { $_.FullName -notlike "$((Resolve-Path $Out).Path)*" } |
  Sort-Object FullName | ForEach-Object { '{0}  {1}' -f (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLower(), (& $rel $_.FullName) }
$manifest | Set-Content "$Out/SHA256-MANIFEST.txt" -Encoding ascii

$fail = 0
if ($Compare) {
  $old = @{}; Get-Content $Compare | ForEach-Object { if ($_ -match '^([0-9a-f]{64})  (.+)$') { $old[$Matches[2]] = $Matches[1] } }
  $new = @{}; $manifest | ForEach-Object { if ($_ -match '^([0-9a-f]{64})  (.+)$') { $new[$Matches[2]] = $Matches[1] } }
  foreach ($k in $old.Keys) { if (-not $new.ContainsKey($k)) { Write-Error "MISSING  $k" -ErrorAction Continue; $fail++ } elseif ($new[$k] -ne $old[$k]) { Write-Error "MODIFIED $k" -ErrorAction Continue; $fail++ } }
  foreach ($k in $new.Keys) { if (-not $old.ContainsKey($k)) { Write-Error "EXTRA    $k" -ErrorAction Continue; $fail++ } }
}

$by = $rows | Group-Object Status | ForEach-Object { "$($_.Name)=$($_.Count)" }
Write-Host "Audited $($rows.Count) binaries ($($by -join ', ')); manifest has $($manifest.Count) files. Report: $Out"
$must = $rows | Where-Object { $_.ExpectedSigned -like 'yes*' -and $_.Status -ne 'Valid' }
if ($must) { Write-Warning "$(@($must).Count) file(s) expected to be signed are not Valid:"; $must | ForEach-Object { Write-Warning "  $($_.File) [$($_.Status)] origin=$($_.Origin)" } }
$unk = $rows | Where-Object { $_.Origin -eq 'unknown' }
if ($unk) { Write-Warning "$(@($unk).Count) file(s) of unknown origin (not auto-signed; review): $(($unk.File) -join ', ')" }
if ($fail) { exit 1 }
