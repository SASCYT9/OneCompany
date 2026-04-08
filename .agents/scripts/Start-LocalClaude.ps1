# d:\OneCompany\.agents\scripts\Start-LocalClaude.ps1

Write-Host "🚀 Ініціалізація локального проксі для Claude Code..." -ForegroundColor Cyan
Write-Host "👉 Перевіряємо запуск LiteLLM на порту 4000..."

# Запуск LiteLLM як фонового процесу для трансляції (Anthropic -> Ollama)
Start-Process -NoNewWindow -FilePath "litellm" -ArgumentList "--config d:\OneCompany\.agents\scripts\litellm_config.yaml --port 4000"

# Чекаємо 3 секунди на запуск проксі
Start-Sleep -Seconds 3

Write-Host "`n⚙️ Підміна оригінальних ключів API на локальні...`n" -ForegroundColor Yellow
$env:ANTHROPIC_BASE_URL="http://localhost:4000"
$env:ANTHROPIC_API_KEY="sk-local-gemma4" # фіктивний ключ, оскільки сервер локальний

Write-Host "✅ Все готово! Запускаємо безкоштовний Claude Code!`n" -ForegroundColor Green

# Запускаємо термінал claude
claude
