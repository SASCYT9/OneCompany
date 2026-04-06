param(
    [string]$RepoUser,
    [string]$PluginRepo,
    [string]$PluginId
)

$targetDir = "d:\OneCompany\wiki\.obsidian\plugins\$PluginId"
if (!(Test-Path $targetDir)) {
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
}

Write-Host "Fetching latest release for $RepoUser/$PluginRepo..."
$latestRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$RepoUser/$PluginRepo/releases/latest"

foreach ($asset in $latestRelease.assets) {
    if ($asset.name -in @('main.js', 'manifest.json', 'styles.css')) {
        $destPath = Join-Path $targetDir $asset.name
        Write-Host "Downloading $($asset.name)..."
        Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $destPath
    }
}

Write-Host "Successfully installed $PluginId!`n"
