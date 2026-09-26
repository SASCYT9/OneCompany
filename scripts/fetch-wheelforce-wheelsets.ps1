param(
  [string]$OutputDirectory = ".tmp/wheelforce-wheelsets/raw",
  [switch]$FetchDetails
)

$ErrorActionPreference = "Stop"
$baseUrl = "https://wheelforce.de"
$absoluteOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
$null = New-Item -ItemType Directory -Force -Path $absoluteOutput
$headers = @{ "User-Agent" = "OneCompanyCatalogResearch/1.0 (public product catalog import)" }
$pageUrls = @("$baseUrl/komplettraeder") + (2..9 | ForEach-Object { "$baseUrl/komplettraeder`_s$_" })
$setProducts = [System.Collections.Generic.List[object]]::new()
$seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

for ($page = 1; $page -le $pageUrls.Count; $page++) {
  $response = Invoke-WebRequest -Uri $pageUrls[$page - 1] -TimeoutSec 45 -Headers $headers
  $listPath = Join-Path $absoluteOutput ("list-{0:D2}.html" -f $page)
  [System.IO.File]::WriteAllText($listPath, $response.Content, [System.Text.UTF8Encoding]::new($false))
  $anchors = [regex]::Matches($response.Content, '(?is)<a\b[^>]*href="(https://wheelforce\.de/[^"?#]+)"[^>]*>(.*?)</a>')
  foreach ($anchor in $anchors) {
    $inner = $anchor.Groups[2].Value
    if ($inner -notmatch 'productbox-title') { continue }
    $titleMatch = [regex]::Match($inner, '(?is)class="productbox-title"[^>]*>\s*<span[^>]*>(.*?)</span>')
    if (-not $titleMatch.Success) { continue }
    $title = [System.Net.WebUtility]::HtmlDecode([regex]::Replace($titleMatch.Groups[1].Value, '<[^>]+>', ' '))
    $title = ($title -replace '&nbsp;', ' ' -replace '\s+', ' ').Trim()
    $url = $anchor.Groups[1].Value.TrimEnd('/')
    if ($title -notmatch '^SET\s*\|' -or -not $url.StartsWith("$baseUrl/", [System.StringComparison]::OrdinalIgnoreCase)) { continue }
    if ($seen.Add($url)) {
      $setProducts.Add([pscustomobject]@{ index = $setProducts.Count + 1; title = $title; url = $url; categoryPage = $page })
    }
  }
  Write-Output ("Listed page {0}/{1}; unique vehicle sets found: {2}" -f $page, $pageUrls.Count, $setProducts.Count)
}

$manifestPath = Join-Path $absoluteOutput "manifest.json"
$manifest = [pscustomobject]@{
  generatedAt = [DateTime]::UtcNow.ToString("o")
  source = "$baseUrl/komplettraeder"
  sourcePageCount = $pageUrls.Count
  listedSetCount = $setProducts.Count
  products = @($setProducts)
}
[System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 6), [System.Text.UTF8Encoding]::new($false))
Write-Output ("Wrote source manifest: {0}" -f $manifestPath)

if (-not $FetchDetails) { return }
if ($PSVersionTable.PSVersion.Major -lt 7) { throw "-FetchDetails requires PowerShell 7 for bounded parallel downloads." }

$failures = @(
  $setProducts | ForEach-Object -Parallel {
    $product = $_
    $destination = Join-Path $using:absoluteOutput ("set-{0:D4}.html" -f $product.index)
    $headers = $using:headers
    $lastError = $null
    for ($attempt = 1; $attempt -le 3; $attempt++) {
      try {
        Start-Sleep -Milliseconds (250 * $attempt)
        $response = Invoke-WebRequest -Uri $product.url -TimeoutSec 45 -Headers $headers
        [System.IO.File]::WriteAllText($destination, $response.Content, [System.Text.UTF8Encoding]::new($false))
        return [pscustomobject]@{ index = $product.index; ok = $true; error = $null }
      } catch {
        $lastError = $_.Exception.Message
        if ($attempt -lt 3) { Start-Sleep -Seconds $attempt }
      }
    }
    return [pscustomobject]@{ index = $product.index; ok = $false; error = $lastError }
  } -ThrottleLimit 3
)

$failed = @($failures | Where-Object { -not $_.ok })
Write-Output ("Downloaded {0}/{1} official set pages." -f ($failures.Count - $failed.Count), $failures.Count)
if ($failed.Count) {
  $failed | ConvertTo-Json -Depth 4 | Write-Output
  throw "WheelForce official set page download was incomplete."
}
