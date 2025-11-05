# OneCompany Premium EPIC Theme - Preview

## Screenshot Instructions

Для створення screenshot.png (1200x900px):

1. Відкрийте головну сторінку сайту
2. Зробіть скріншот верхньої частини (Hero section з анімаціями)
3. Збережіть як `screenshot.png` в корені теми
4. Розмір: 1200x900 пікселів

## Тимчасове рішення

Створюємо базове превью через PowerShell:

```powershell
# Створення чорного зображення 1200x900
Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap(1200, 900)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.Color]::FromArgb(10, 10, 10))

# Текст
$font = New-Object System.Drawing.Font("Arial", 48, [System.Drawing.FontStyle]::Bold)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(201, 169, 97))
$graphics.DrawString("ONECOMPANY", $font, $brush, 300, 350)
$graphics.DrawString("PREMIUM EPIC", $font, $brush, 250, 450)

$bitmap.Save("screenshot.png")
$graphics.Dispose()
$bitmap.Dispose()
```
