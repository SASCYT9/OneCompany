# 🚀 ONE COMPANY - Docker Start Script
# Запускає обидва сайти автоматично

Write-Host "=================================" -ForegroundColor Cyan
Write-Host "🚗 ONE COMPANY - Starting Docker" -ForegroundColor Yellow
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Перевірка чи Docker запущений
$dockerStatus = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker не запущений!" -ForegroundColor Red
    Write-Host "Запустіть Docker Desktop і спробуйте знову." -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "✅ Docker запущений" -ForegroundColor Green
Write-Host ""

# Зупиняємо старі контейнери якщо є
Write-Host "🧹 Очищення старих контейнерів..." -ForegroundColor Yellow
docker-compose down 2>$null

Write-Host ""
Write-Host "🏗️  Білдимо та запускаємо контейнери..." -ForegroundColor Yellow
Write-Host ""

# Запускаємо Docker Compose з білдом
docker-compose up --build -d

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=================================" -ForegroundColor Green
    Write-Host "✅ УСПІШНО ЗАПУЩЕНО!" -ForegroundColor Green
    Write-Host "=================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Ваші сайти доступні за адресами:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   📱 Next.js (React 3D Hub):" -ForegroundColor Yellow
    Write-Host "      http://localhost:3000" -ForegroundColor White
    Write-Host ""
    Write-Host "   📄 WordPress (Premium Hub):" -ForegroundColor Yellow
    Write-Host "      http://localhost:8080" -ForegroundColor White
    Write-Host "      Admin: http://localhost:8080/wp-admin" -ForegroundColor Gray
    Write-Host ""
    Write-Host "=================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "💡 Корисні команди:" -ForegroundColor Yellow
    Write-Host "   docker-compose logs -f           # Дивитись логи" -ForegroundColor Gray
    Write-Host "   docker-compose ps                # Статус контейнерів" -ForegroundColor Gray
    Write-Host "   .\docker-stop.ps1                # Зупинити все" -ForegroundColor Gray
    Write-Host ""
    
    # Відкриваємо браузер (опціонально - закоментуйте якщо не треба)
    Start-Sleep -Seconds 5
    Write-Host "🌐 Відкриваю браузер..." -ForegroundColor Yellow
    Start-Process "http://localhost:3000"
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:8080"
    
} else {
    Write-Host ""
    Write-Host "❌ Помилка при запуску Docker!" -ForegroundColor Red
    Write-Host "Перевірте логи: docker-compose logs" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Натисніть будь-яку клавішу для виходу..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
