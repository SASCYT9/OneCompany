# Legacy local experiment. See README.md in this directory before running.

Write-Host "🚀 Ініціалізація локального проксі для Claude Code..." -ForegroundColor Cyan
Write-Host "👉 Перевіряємо запуск LiteLLM на порту 4000..."

# Запуск LiteLLM як фонового процесу для трансляції (Anthropic -> Ollama)
$configPath = Join-Path $PSScriptRoot "litellm_config.yaml"
Start-Process -NoNewWindow -FilePath "litellm" -ArgumentList "--config `"$configPath`" --port 4000"

# Чекаємо 3 секунди на запуск проксі
Start-Sleep -Seconds 3

Write-Host "`n⚙️ Підміна оригінальних ключів API на локальні...`n" -ForegroundColor Yellow
$env:ANTHROPIC_BASE_URL="http://localhost:4000"
$env:ANTHROPIC_API_KEY="sk-local-gemma4" # фіктивний ключ, оскільки сервер локальний

Write-Host "✅ Локальний compatibility proxy запущено; його якість і модель не еквівалентні Claude.`n" -ForegroundColor Green

# Запускаємо термінал claude
claude
