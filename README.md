# LD LATTE — три задания по автоматизации

Материалы для проверки собраны в одном репозитории. Рабочая ветка сдачи: `review/all-tasks`. [Приватный репозиторий GitHub](https://github.com/Kasspier/ld-latte-test-automation/tree/review/all-tasks). Приватность отдельных веток Git не поддерживает. Проверяющему требуется приглашение; одной ссылки недостаточно.

| Задача | Материалы | Проверка |
| --- | --- | --- |
| 1. Telegram + n8n | [Инструкция](ld-latte-telegram/README.md), [workflow](ld-latte-telegram/workflow/LD-LATTE-menu.json), [показ со снимками](ld-latte-telegram/output/TELEGRAM-DEMO.html) | 14 автоматических тестов, 12 интеграционных сценариев, полный показ 2/5/9/0 и изменения каталога в Telegram |
| 2. Instagram | [Бизнес-план со схемами](ld-latte-instagram/index.html), [техническое приложение](ld-latte-instagram/technical.html), [сверка](ld-latte-instagram/ACCEPTANCE.md) | Исследование и план по ТЗ; реальные аккаунты и реализация интеграции не требуются |
| 3. Веб-сервис | [Запуск](ld-latte-requests/README.md), [API](ld-latte-requests/docs/API.md), [Postman](ld-latte-requests/docs/TESTING.md), [результаты](ld-latte-requests/docs/VERIFICATION.md) | Next.js + Supabase, JWT, RLS, заявки, поиск, статусы; [Открыть работающий сайт](https://ld-latte-requests-omega.vercel.app) |

HTML нужно скачать вместе с соответствующей папкой и открыть браузером: GitHub отображает исходный код HTML, а не исполняет его. У Telegram-отчёта изображения находятся рядом в `output/telegram/`.

Проверки [GitHub Actions](https://github.com/Kasspier/ld-latte-test-automation/actions) прошли для всех трёх проектов. Веб-сервис опубликован: [https://ld-latte-requests-omega.vercel.app](https://ld-latte-requests-omega.vercel.app). Тариф Vercel — Hobby. Исходники сайта соответствуют коммиту `2e765a0`; последующие изменения комплекта относятся к документации и Postman-окружению.

## Веб-сервис локально

```powershell
cd ld-latte-requests
npm ci
Copy-Item .env.example .env.local
# Заполнить Project URL и publishable key своего Supabase.
npm run dev
```

В своей базе примените миграции по README веб-проекта. Локальный адрес: http://127.0.0.1:3000. Сервис хранит данные в Supabase; аккаунты и заявки отделены RLS на уровне PostgreSQL.

## Проверки

```powershell
cd ld-latte-requests
npm ci
npm test
npm run typecheck
npm run build
```

Postman-коллекция и пустое окружение: `ld-latte-requests/postman/`. Приватную копию с тестовыми паролями заполните локально. Облачные интеграционные тесты создают вымышленные заявки; CI не получает пароли и токены Supabase.

Telegram запускается отдельно через Docker; см. его README. Токен BotFather создаётся и сохраняется локально. Во время внешней проверки локального бота компьютер владельца должен оставаться включённым.

## Размещение и доступ проверяющего

Порядок публикации и ограничения read-only: [DEPLOYMENT.md](DEPLOYMENT.md). Веб-приложение и исходники имеют разные настройки доступа: приватность репозитория не закрывает автоматически страницу приложения.

Токены Telegram, App Secret, service role, пароли, `.env.local`, приватные Postman-окружения и полные снимки личных переписок в репозиторий не включены. В `.env.example` только шаблоны. Publishable key предназначен для клиента, однако в комплекте оставлен универсальный шаблон подключения.


## Режим сдачи

Репозиторий остаётся Private. После завершения материалов отдельный репозиторий сдачи архивируется для режима read-only. Архивация не останавливает размещённый сайт. Для последующих исправлений или приглашения нового проверяющего владелец сначала разархивирует репозиторий. Username проверяющего пока неизвестен, поэтому приглашения не отправлены; приватная ссылка сама по себе не открывает доступ.

Публикация выполнена из проверенных исходников через Vercel API под аккаунтом владельца. GitHub Login Connection в Vercel не настроена, поэтому автоматическое обновление сайта по push пока не включено. Код и история доступны в GitHub отдельно.
