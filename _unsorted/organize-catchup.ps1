<#
  organize-catchup.ps1 - Catchup folder organizer (pure ASCII, PS 5.1 safe)
  * Moves files only. No deletion. Unmapped files go to _unsorted.
  * Run from inside the Catchup folder:
      Preview :  .\organize-catchup.ps1
      Execute :  .\organize-catchup.ps1 -Execute
  * If blocked once:  Unblock-File .\organize-catchup.ps1
  * Root auto-detected from the script location (handles Korean paths safely).
#>

param(
  [string]$Root = $PSScriptRoot,
  [switch]$Execute
)

$ErrorActionPreference = 'Stop'
if (-not $Root -or $Root -eq '') { $Root = (Get-Location).Path }
if (-not (Test-Path -LiteralPath $Root)) { Write-Error "Folder not found: $Root"; exit 1 }

# Exact name -> Destination (optional new name). ASCII filenames only.
$map = @(
  @{ n='catchup-core-spec-v1.md';     d='00_plan' }
  @{ n='catchup-ui-spec-v1.md';       d='00_plan' }
  @{ n='catchup-terms-of-service.md'; d='01_legal' }
  @{ n='admin-setup.sql';             d='02_backend\schema' }
  @{ n='catchup-schema-rls.sql';      d='02_backend\schema' }
  @{ n='search-schools.sql';          d='02_backend\schema' }
  @{ n='verification-schema.sql';     d='02_backend\schema' }
  @{ n='ingest-schools.mjs';          d='02_backend\data' }
  @{ n='mock-neis.mjs';               d='02_backend\data' }
  @{ n='neis-core.mjs';               d='02_backend\data' }
  @{ n='mock-neis-core.mjs';          d='02_backend\data' }
  @{ n='neis-format.js';              d='02_backend\data' }
  @{ n='test-logic.mjs';              d='02_backend\data' }
  @{ n='catchup-sync-schools.mjs';    d='02_backend\data' }
  @{ n='schools-api.js';              d='02_backend\data' }
  @{ n='supabaseClient.js';           d='02_backend\data' }
  @{ n='out';                         d='02_backend\data' }
  @{ n='index.ts';        d='02_backend\edge-functions\verify-student-id' }
  @{ n='logic.ts';        d='02_backend\edge-functions\verify-student-id' }
  @{ n='index(admin).ts'; d='02_backend\edge-functions\admin-review'; new='index.ts' }
  @{ n='AdminReview.jsx'; d='02_backend\edge-functions\admin-review' }
  @{ n='comments.ts';         d='03_app\source' }
  @{ n='community.ts';        d='03_app\source' }
  @{ n='neis.ts';             d='03_app\source' }
  @{ n='tokens.ts';           d='03_app\source' }
  @{ n='RootTabs.tsx';        d='03_app\source' }
  @{ n='CommunityScreen.tsx'; d='03_app\source' }
  @{ n='DMThreadScreen.tsx';  d='03_app\source' }
  @{ n='HomeDashboard.tsx';   d='03_app\source' }
  @{ n='PostDetailScreen.tsx';d='03_app\source' }
  @{ n='HomeCards.tsx';       d='03_app\source' }
  @{ n='PostComposer.tsx';    d='03_app\source' }
  @{ n='catchup-src.zip';  d='03_app' }
  @{ n='catchup-app.zip';  d='_archive' }
  @{ n='TodayCard.jsx';    d='_archive' }
  @{ n='SchoolSearch.jsx'; d='_archive' }
  @{ n='package-lock.json';d='_archive' }
)

# Pattern rules for Korean-named files (matched by wildcard, no Korean literals)
$patternRules = @(
  @{ p='*.txt';           d='00_plan' }   # 1cha meeting note (only .txt)
  @{ p='catchup-terms-*'; d='01_legal' }  # includes the je2jo amendment
)

$skipTop = @('00_plan','01_legal','02_backend','03_app','_archive','_unsorted','organize-catchup.ps1')

$lookup = @{}
foreach ($m in $map) { $lookup[$m.n] = $m }

$destDirs = ($map | ForEach-Object { $_.d }) + ($patternRules | ForEach-Object { $_.d }) + @('_unsorted') | Select-Object -Unique
if ($Execute) {
  foreach ($d in $destDirs) {
    $full = Join-Path $Root $d
    if (-not (Test-Path -LiteralPath $full)) { New-Item -ItemType Directory -Path $full -Force | Out-Null }
  }
}

function Move-Safe($srcFull, $destDir, $newName) {
  $destFull = Join-Path $Root $destDir
  $name = if ($newName) { $newName } else { Split-Path $srcFull -Leaf }
  $target = Join-Path $destFull $name
  if (Test-Path -LiteralPath $target) {
    $base = [IO.Path]::GetFileNameWithoutExtension($name)
    $ext  = [IO.Path]::GetExtension($name)
    $i = 1; do { $target = Join-Path $destFull ("$base($i)$ext"); $i++ } while (Test-Path -LiteralPath $target)
  }
  if ($Execute) {
    if (-not (Test-Path -LiteralPath $destFull)) { New-Item -ItemType Directory -Path $destFull -Force | Out-Null }
    Move-Item -LiteralPath $srcFull -Destination $target
  }
  return "$destDir\$(Split-Path $target -Leaf)"
}

$plan = @()
Get-ChildItem -LiteralPath $Root -Force | Where-Object { $skipTop -notcontains $_.Name } | ForEach-Object {
  $item = $_
  $rule = $lookup[$item.Name]
  $dest = $null; $newName = $null
  if ($rule) { $dest = $rule.d; $newName = $rule.new }
  else {
    foreach ($pr in $patternRules) { if ($item.Name -like $pr.p) { $dest = $pr.d; break } }
    if (-not $dest) { $dest = '_unsorted' }
  }
  $to = Move-Safe $item.FullName $dest $newName
  $plan += [pscustomobject]@{ Name = $item.Name; MovedTo = $to }
}

Write-Host ""
if ($Execute) { Write-Host "[DONE] organized:" -ForegroundColor Green }
else { Write-Host "[PREVIEW] nothing moved yet. To run:  .\organize-catchup.ps1 -Execute" -ForegroundColor Yellow }
Write-Host ""
$plan | Sort-Object MovedTo | Format-Table -AutoSize
$unmatched = ($plan | Where-Object { $_.MovedTo -like '_unsorted*' }).Count
Write-Host ""
Write-Host ("Total {0} item(s). _unsorted: {1}" -f $plan.Count, $unmatched) -ForegroundColor Cyan
if ($unmatched -eq 0) { Write-Host "All files matched a rule. Clean!" -ForegroundColor Green }
