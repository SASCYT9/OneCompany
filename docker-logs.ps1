# 📋 ONE COMPANY - Docker Logs Viewer
# Показує логи всіх контейнерів в реальному часі

Write-Host "=================================" -ForegroundColor Cyan
Write-Host "📋 ONE COMPANY - Docker Logs" -ForegroundColor Yellow
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Щоб вийти натисніть Ctrl+C" -ForegroundColor Gray
Write-Host ""

# Показуємо логи з слідкуванням
docker-compose logs -f
