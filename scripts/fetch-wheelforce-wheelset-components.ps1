param(
  [string]$WheelSetCatalog = "src/data/wheelforce/wheel-only-sets.json",
  [string]$OutputDirectory = ".tmp/wheelforce-wheelset-components"
)

$ErrorActionPreference = "Stop"
$baseUrl = "https://wheelforce.de"
$absoluteCatalog = [System.IO.Path]::GetFullPath($WheelSetCatalog)
$absoluteOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
$null = New-Item -ItemType Directory -Force -Path $absoluteOutput
$catalog = Get-Content -LiteralPath $absoluteCatalog -Raw | ConvertFrom-Json
$componentNames = @(
  $catalog.excludedPages |
    ForEach-Object { $_.components } |
    Where-Object { $_ } |
    ForEach-Object { ([string]$_).Trim() } |
    Where-Object { $_ } |
    Sort-Object -Unique
)
if (-not $componentNames.Count) { throw "No unresolved WheelForce wheel components were found." }

$manifest = [System.Collections.Generic.List[object]]::new()
for ($index = 0; $index -lt $componentNames.Count; $index++) {
  $term = $componentNames[$index]
  $query = [uri]::EscapeDataString($term)
  $manifest.Add([pscustomobject]@{
    index = $index + 1
    title = $term
    searchUrl = "$baseUrl/search/?qs=$query&search="
  })
}
$manifestPath = Join-Path $absoluteOutput "manifest.json"
[System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 5), [System.Text.UTF8Encoding]::new($false))
Write-Output ("Unresolved manufacturer wheel components: {0}" -f $manifest.Count)

$failures = @(
  $manifest | ForEach-Object -Parallel {
    $entry = $_
    $destination = Join-Path $using:absoluteOutput ("component-{0:D4}.html" -f $entry.index)
    $headers = @{ "User-Agent" = "OneCompanyCatalogResearch/1.0 (public product catalog import)" }
    $lastError = $null
    for ($attempt = 1; $attempt -le 3; $attempt++) {
      try {
        Start-Sleep -Milliseconds (200 * $attempt)
        $response = Invoke-WebRequest -Uri $entry.searchUrl -TimeoutSec 45 -Headers $headers
        [System.IO.File]::WriteAllText($destination, $response.Content, [System.Text.UTF8Encoding]::new($false))
        return [pscustomobject]@{ index = $entry.index; ok = $true; error = $null }
      } catch {
        $lastError = $_.Exception.Message
        if ($attempt -lt 3) { Start-Sleep -Seconds $attempt }
      }
    }
    return [pscustomobject]@{ index = $entry.index; ok = $false; error = $lastError }
  } -ThrottleLimit 3
)

$failed = @($failures | Where-Object { -not $_.ok })
Write-Output ("Downloaded official component search pages: {0}/{1}" -f ($failures.Count - $failed.Count), $failures.Count)
if ($failed.Count) {
  $failed | ConvertTo-Json -Depth 4 | Write-Output
  throw "WheelForce component search download was incomplete."
}
