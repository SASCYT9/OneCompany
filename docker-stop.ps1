# 🛑 ONE COMPANY - Docker Stop Script
# Зупиняє всі контейнери

Write-Host "=================================" -ForegroundColor Cyan
Write-Host "🛑 ONE COMPANY - Stopping Docker" -ForegroundColor Yellow
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "⏸️  Зупиняємо контейнери..." -ForegroundColor Yellow
docker-compose down

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Всі контейнери зупинені!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Помилка при зупинці!" -ForegroundColor Red
    Write-Host ""
}

Write-Host "Натисніть будь-яку клавішу для виходу..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
