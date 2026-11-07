# Публикация и доступ для просмотра

## Веб-сервис

Для Next.js используется обычный Node.js-хостинг; подготовленный вариант — Vercel с подключённым приватным GitHub-репозиторием.

1. Создать проект Vercel из этого репозитория. Выбрать ветку `review/all-tasks` и Root Directory `ld-latte-requests`, Framework Preset Next.js.
2. Указать две переменные для нужного окружения: `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Service role не нужен. Публичные переменные попадают в клиентскую сборку — это ожидаемо для publishable key.
3. Выполнить deployment и взять фактический HTTPS URL. Если ветка должна стать Production Branch — выбрать её в настройках Vercel; иначе проверить доступность Preview URL для внешнего проверяющего.
4. В Supabase Auth → URL Configuration указать HTTPS Site URL. Подтверждение почты в текущем демонстрационном проекте выключено по решению владельца; изменение этой настройки отдельно не требуется для ТЗ.
5. Проверить сайт в новом браузерном контексте: регистрация, вход/выход, создание/изменение, статусы, поиск/фильтр, refresh, два пользователя и телефон.
6. Прогнать Postman с `base_url`, равным этому HTTPS URL, и двумя демонстрационными пользователями. Проверить прямые REST-попытки доступа к чужим заявкам.
7. Добавить действительный URL в главный README и результаты в документацию проверки. Не заменять его localhost или вымышленной ссылкой.

## Приватный GitHub и read-only

Все три задания находятся в одной ветке `review/all-tasks`. Репозиторий создаётся **Private**, без автоматического добавления участников. Для выдачи доступа нужен точный username проверяющего.

- **Репозиторий организации:** пригласить проверяющего с ролью `Read`. Это обычный вариант с разделением прав чтения и записи.
- **Личный приватный репозиторий:** GitHub не предоставляет read-only роль для collaborator; обычное приглашение даёт запись. Не выдавайте его как «только просмотр».
- **Зафиксированная сдача личного репозитория:** после завершения можно архивировать отдельный репозиторий сдачи. GitHub делает его read-only для всех; для будущих исправлений владельцу понадобится разархивировать его. Настройка выполняется только после выбора владельцем этого варианта.

Права `Read` не запрещают скачать или скопировать код. Секреты не должны находиться даже в приватной истории Git. Не используйте защиту одной ветки как замену read-only правам на весь репозиторий.

Источники: [права личного репозитория](https://docs.github.com/en/enterprise-cloud%40latest/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/permission-levels-for-a-personal-account-repository), [роли организации](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/repository-roles-for-an-organization), [архивация](https://docs.github.com/en/repositories/archiving-a-github-repository/archiving-repositories).

