#!/bin/bash
echo "🚀 Деплой Flux на Vercel..."

# Устанавливаем Vercel CLI если нужно
if ! command -v vercel &> /dev/null; then
    npm install -g vercel
fi

# Проверяем наличие токена
if [ -z "$VERCEL_TOKEN" ]; then
    echo "❌ Ошибка: VERCEL_TOKEN не установлен"
    exit 1
fi

# Деплой
vercel --token $VERCEL_TOKEN --prod --yes --confirm

echo "✅ Деплой завершен!"
echo "📱 Ссылка: https://flux-pwa.vercel.app"
