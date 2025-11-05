# Create screenshot.png for OneCompany theme
Add-Type -AssemblyName System.Drawing

# Create bitmap 1200x900
$bitmap = New-Object System.Drawing.Bitmap(1200, 900)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

# Background - Deep Black with gradient
$rect = New-Object System.Drawing.Rectangle(0, 0, 1200, 900)
$brush1 = [System.Drawing.Color]::FromArgb(10, 10, 10)
$brush2 = [System.Drawing.Color]::FromArgb(30, 30, 30)
$gradientBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $brush1, $brush2, 45)
$graphics.FillRectangle($gradientBrush, $rect)

# Platinum Gold text
$font1 = New-Object System.Drawing.Font('Arial', 72, [System.Drawing.FontStyle]::Bold)
$font2 = New-Object System.Drawing.Font('Arial', 36, [System.Drawing.FontStyle]::Regular)
$goldBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(201, 169, 97))
$silverBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(192, 192, 192))

# Draw text
$graphics.DrawString('ONECOMPANY', $font1, $goldBrush, 220, 300)
$graphics.DrawString('PREMIUM EPIC THEME', $font2, $silverBrush, 280, 420)
$graphics.DrawString('v2.0.0', $font2, $silverBrush, 520, 500)

# Save
$outputPath = Join-Path $PSScriptRoot 'wp-content\themes\onecompany-theme\screenshot.png'
$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Cleanup
$graphics.Dispose()
$bitmap.Dispose()
$gradientBrush.Dispose()
$goldBrush.Dispose()
$silverBrush.Dispose()

Write-Host "✓ Screenshot created: $outputPath" -ForegroundColor Green
