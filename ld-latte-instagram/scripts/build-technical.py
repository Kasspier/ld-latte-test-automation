"""Build the standalone technical appendix; Python standard library only."""
from pathlib import Path
from html import escape
import re

ROOT = Path(__file__).resolve().parents[1]
business = (ROOT / 'index.html').read_text(encoding='utf-8')
css = re.search(r'<style>(.*?)</style>', business, re.S).group(1)
css += '\n.tech-table{min-width:760px}.flow{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.flow .card{border-top:4px solid var(--green)}.flow b{display:block;color:var(--rose);margin-bottom:8px}.flow p{font-size:13px}h3{margin-top:24px}.card h3{margin-top:0}@media(max-width:760px){.flow{grid-template-columns:1fr}.masthead{flex-wrap:wrap}.masthead .brand{flex-basis:100%;white-space:nowrap}}'

def table(head, rows):
    return '<div class="table-wrap"><table class="tech-table"><thead><tr>' + ''.join('<th>'+h+'</th>' for h in head) + '</tr></thead><tbody>' + ''.join('<tr>'+''.join('<td>'+c+'</td>' for c in row)+'</tr>' for row in rows) + '</tbody></table></div>'

def code(text):
    return '<pre><code>'+escape(text.strip())+'</code></pre>'

sections = []
def section(id, title, body):
    sections.append((id, title, body))

section('decision', 'Выбор подключения и границы проекта', '''
<p>Цель: получать подписчиков, просмотры, охват и результаты собственных публикаций нескольких аккаунтов в общей отчётности. Основной маршрут — <strong>Instagram API with Unified Login</strong>, рекомендованный Meta для новых интеграций. Вызовы — через <code>graph.facebook.com</code>; в просмотренной справке актуальна версия <code>v27.0</code>. Версию фиксируем в настройках и проверяем перед обновлением.</p>
<p>Предварительные условия: профессиональные профили Business/Creator, доступ владельца к их бизнес-портфолио, корпоративное приложение Meta в портфолио компании, администратор приложения, Facebook Login for Business, HTTPS callback и подготовка webhook endpoint по руководству Meta. Аккаунты не связываются друг с другом. Для Page-based Facebook Login каждый связан со своей Facebook Page; для Unified Login Page не обязательна.</p>
<div class="callout"><strong>План, который можно передать специалисту</strong><p>В рамках задания не создаём приложение Meta, не получаем токены и не обращаемся к реальным аккаунтам. Примеры запросов ниже — шаблоны внедрения, а не результаты выполненной интеграции.</p></div>
''' + table(['Вариант','Объекты и токен','Права для статистики'], [
('Unified Login · основной','Бизнес-портфолио обязательно; один Business Integration System User Access Token (SUAT) для выданных объектов выбранного портфолио; host Facebook.','<code>instagram_basic</code> + <code>instagram_manage_insights</code>. Мастер также требует <code>instagram_manage_messages</code>; это отдельный предмет согласования.'),
('Instagram Login · альтернатива','Facebook Page не нужна; согласие каждого профиля; Instagram User token; host Instagram.','<code>instagram_business_basic</code> + <code>instagram_business_manage_insights</code>.'),
('Facebook Login · вариант для существующих Pages','Нужна связанная Page и сотрудник с правом анализа; Facebook User token для Insights; host Facebook.','<code>instagram_basic</code>, <code>instagram_manage_insights</code>, <code>pages_read_engagement</code>; <code>pages_show_list</code> для поиска Pages. При роли через Business Manager справка также указывает <code>ads_read</code> или <code>ads_management</code> — проверить конкретный способ назначения прав.')
]) + '''<p class="source">Основание: <a href="#r1">обзор [1]</a>, <a href="#r2">настройка [2]</a>, <a href="#r4">разрешения [4]</a>, <a href="#r6">Insights [6]</a>. Поля, ID, токены и scopes разных конфигураций не взаимозаменяемы.</p>''')

section('permissions', 'Права, роли и жизненный цикл токена', '''
<h3>Настройка прав основного маршрута</h3>
<p>В <code>Use cases → Manage messaging &amp; content on Instagram → Customize → API setup with unified login</code> создаём конфигурацию и сохраняем <code>config_id</code>. Мастер по умолчанию включает также публикацию, комментарии и рекламу. <strong>Убираем необязательные права и рекламные объекты</strong>, добавляем <code>instagram_manage_insights</code>. В текущем руководстве <code>instagram_basic</code> и <code>instagram_manage_messages</code> обязательны для создаваемой конфигурации: нельзя обещать владельцу исключительно read-only согласие.</p>
<p>Если компания не согласна на обязательное право сообщений, выбираем Instagram Login с двумя аналитическими scopes. Право <code>business_management</code> нужно для Business Integration System User Access Token Management API; добавляем его только при выборе этого способа сопровождения и отдельно объясняем владельцу. Не используем права публикации или рекламы в сборщике статистики.</p>
<p>Для пилота назначаем администратору/разработчику роль в приложении, приглашаем настоящий профессиональный тестовый аккаунт и принимаем приглашение. Синтетические test users этим руководством не поддерживаются. Стандартного доступа достаточно для соответствующих собственных/управляемых аккаунтов с ролями. Для внешних пользователей — Live mode, Advanced Access для каждого запрашиваемого права, App Review и необходимое подтверждение компании. Успех у администратора ещё не доказывает доступ у клиента без роли.</p>
''' + table(['Токен','Получение и срок','Сопровождение'], [
('Unified Login · SUAT','Сервер обменивает OAuth code с Meta App ID/Secret. Срок зависит от конфигурации и показан в её preview; правило «60 дней для всех» здесь неверно.','Сохраняем client_business_id, config_id, выданные IG ID, ссылку на зашифрованный секрет и известный срок. Проверяем доступ перед сбором; управление/обновление — через Business Integration System User Access Token Management API по его требованиям. Если оно не настроено — заранее переподключаем через владельца, а не ждём отказа.'),
('Instagram Login · User token','POST к api.instagram.com/oauth/access_token → краткосрочный; GET graph.instagram.com/access_token с ig_exchange_token → долгосрочный до 60 дней. Используем Instagram App ID/Secret.','GET /refresh_access_token с ig_refresh_token: только для действующего долгосрочного токена старше 24 часов. Предлагаемый регламент — обновление на 30-й день, повтор и уведомление при сбое. Сохраняем фактический expires_in. Истёкший токен требует нового OAuth.'),
('Facebook Login · User/Page','OAuth через Facebook; для маршрута Insights ориентируемся на Facebook User token из таблицы требований endpoint. /me/accounts помогает найти Pages и IG ID.','Не переносим механизм ig_refresh_token на Facebook. Проверяем фактический срок и права в Access Token Debugger/Token Debugging API; поддержание по документации Facebook Login. Page token из старой коллекции не считаем универсальным эквивалентом User token для любого endpoint.')
]) + '''<h3>Хранение и отзыв</h3><p>Токены и App Secret — только в серверном хранилище секретов, шифрование при хранении, доступ только сборщику. В базе аккаунтов — ссылка на секрет. Не включаем значения в HTML, BI, git, логи и уведомления. В запросах данных предпочитаем заголовок Bearer; параметры обмена, которые требует OAuth endpoint, маскируем в серверных журналах. Токен может быть отозван раньше срока. При удалении интеграции или переносе профиля в другое портфолио останавливаем затронутое подключение и просим владельца пройти вход заново. Уже сохранённые показатели не затираем.</p>
<p class="source">Основание: <a href="#r2">настройка [2]</a>, <a href="#r3">SUAT [3]</a>, <a href="#r4">права [4]</a>, <a href="#r9">Instagram OAuth [9]</a>, <a href="#r11">диагностика [11]</a>. Сроки и расписание контроля выше разделены: свойства API и предлагаемый регламент компании.</p>''')

section('first-call', 'От исходного аккаунта до первого запроса', '''
<p>Владелец готовит профили и выбирает портфолио/аккаунты. Специалист настраивает конфигурацию, права и точный HTTPS redirect URI. Сервер создаёт одноразовый <code>state</code>, связывает его с сессией подключения, проверяет на callback и сразу обменивает code. Отмену согласия обрабатываем как отмену, без попыток создать пустое подключение.</p>
<div class="flow" role="group" aria-label="Последовательность технического подключения">
<div class="card"><b>01 · Владелец → Meta</b><p>Вход по config_id. Выбор портфолио и нескольких IG. Проверка согласия.</p></div>
<div class="card"><b>02 · Meta → Сервер</b><p>Callback: code + state. Проверка state. Серверный обмен на SUAT.</p></div>
<div class="card"><b>03 · Сервер → Graph API</b><p>client_business_id и assigned_instagram_accounts. Проверка всех страниц списка.</p></div>
<div class="card"><b>04 · Graph API → Сборщик</b><p>Профиль, subscribers, reach и views пилота. Отдельно статистика одной публикации.</p></div>
<div class="card"><b>05 · Сборщик → База</b><p>Нормализация, период, единицы и статус. Запись без дублей.</p></div>
<div class="card"><b>06 · База → Отчёт</b><p>Сверка маркетологом. Дата обновления. Подключение остальных профилей и расписание.</p></div></div>
<h3>1. Ссылка согласия</h3>''' + code('''https://www.facebook.com/dialog/oauth?
  client_id=<META_APP_ID>&config_id=<CONFIG_ID>
  &redirect_uri=<URL_ENCODED_HTTPS_CALLBACK>
  &response_type=code&prompt=login&state=<ONE_TIME_RANDOM_STATE>''') + '''
<h3>2. Обмен на сервере</h3><p>Согласно текущему руководству Unified Login: <code>GET https://graph.facebook.com/v27.0/oauth/access_token</code>, параметры <code>client_id</code>, <code>client_secret</code>, <code>code</code>. Секрет не попадает в браузер. Проверяем соответствие redirect URI конфигурации и требованиям выбранного OAuth-потока; пример руководства Meta опускает этот параметр обмена. Код не переиспользуем.</p>
<h3>3. Определение бизнеса и аккаунтов</h3>''' + code('''GET https://graph.facebook.com/v27.0/me?fields=client_business_id
Authorization: Bearer <SUAT>

GET https://graph.facebook.com/v27.0/me/assigned_instagram_accounts?fields=id,username
Authorization: Bearer <SUAT>''') + '''<p><strong>В Unified Login /me — системный пользователь, а не Instagram-профиль.</strong> Сохраняем полученный business ID и каждый выбранный IG ID как строку. Для следующего запроса берём конкретный ID из assigned_instagram_accounts; не подставляем /me и не вычисляем его по username.</p>
<h3>4. Профиль и первая статистика</h3>''' + code('''GET https://graph.facebook.com/v27.0/<IG_ID>?fields=id,username,followers_count
Authorization: Bearer <SUAT>

GET https://graph.facebook.com/v27.0/<IG_ID>/insights?metric=reach,views&period=day&metric_type=total_value&since=<UNIX_START>&until=<UNIX_END>
Authorization: Bearer <SUAT>

GET https://graph.facebook.com/v27.0/<IG_ID>/media?fields=id,media_type,media_product_type,timestamp,permalink
Authorization: Bearer <SUAT>

GET https://graph.facebook.com/v27.0/<MEDIA_ID>/insights?metric=views,reach
Authorization: Bearer <SUAT>''') + '''<p>UNIX_START/END задаём явно для одного завершённого дня в согласованной зоне; сохраняем фактические границы. Справка описывает включённые границы since/until: не предполагаем автоматически полуоткрытый интервал; проверяем границу на пилоте. Для публикации это lifetime, не статистика выбранных суток. Затем пробуем допустимые метрики её формата. Нормализатор читает как <code>total_value.value</code>, так и <code>values[].value</code>, проверяет имя и период. Пустой data — «нет данных», не ноль. Успех подтверждается валидным ответом нужного объекта и сверкой, а не только HTTP 200.</p>
<p class="source">Порядок и запросы: <a href="#r2">Get Started [2]</a>, <a href="#r7">Account Insights [7]</a>, <a href="#r8">Media Insights [8]</a>, <a href="#r10">IG User [10]</a>. Это шаблоны; реальные ответы не получены по условиям задания.</p>''')

section('metrics-api', 'Метрики: запрос, период и ограничения', '''
<p>Для основного маршрута все пути ниже начинаются с <code>https://graph.facebook.com/v27.0</code>. В варианте Instagram Login используем <code>graph.instagram.com</code> и его токен. Проверяем поддержку набора метрик по endpoint и формату, а не отправляем один общий список всем публикациям.</p>
''' + table(['Показатель','Способ получения','Период / хранение','Условия и смысл'], [
('Подписчики сейчас','GET /{IG_ID}?fields=followers_count','Снимок на collected_at; сохраняем ежедневно.','Это поле профиля с множественным followers_count, а не одноимённая метрика Insights. Прошлую ежедневную численность задним числом не обещаем.'),
('Подписки и отписки','GET /{IG_ID}/insights?metric=follows_and_unfollows&amp;period=day&amp;metric_type=total_value&amp;breakdown=follow_type','Диапазон since/until; общая история аккаунта у Meta — 90 дней.','Нужны минимум 100 подписчиков. Если недоступно, разница снимков followers_count даёт только чистый прирост. Метрику follower_count из старых примеров не используем вместо текущего счётчика.'),
('Просмотры аккаунта','GET /{IG_ID}/insights?metric=views&amp;period=day&amp;metric_type=total_value','Явные since/until; история аккаунта 90 дней.','Число показов/воспроизведений контента, с повторами. Не посещения профиля. impressions упразднена для аккаунтов; в старых примерах Meta ещё встречается — приоритет у справки версии.'),
('Охват аккаунта','GET /{IG_ID}/insights?metric=reach&amp;period=day&amp;metric_type=total_value','Явные since/until; day + total_value для итога нужного диапазона.','Уникальные аккаунты; оценочная метрика. Дневные/межаккаунтные охваты нельзя суммировать как уникальный охват месяца/компании. Для месячного значения запрашиваем нужный диапазон отдельно.'),
('Пост / карусель / Reels','GET /{MEDIA_ID}/insights?metric=views,reach,likes,comments,saved,shares,total_interactions','Как правило lifetime на момент сбора; Meta указывает хранение медиа-метрик 2 года.','Проверяем media_product_type. Метрика saved у медиа и saves у аккаунта различаются. У карусели запрашиваем контейнер; дочерние элементы не имеют отдельных Insights.'),
('Время просмотра Reels','GET /{MEDIA_ID}/insights?metric=ig_reels_avg_watch_time,ig_reels_video_view_total_time','Lifetime; снимки с collected_at.','Только REELS; единицы и определение сохраняем по справке конкретной метрики/ответу перед настройкой отчёта. Не подменяем views старым plays. Facebook/crossposted_views храним отдельно от Instagram views.'),
('Stories','GET /{IG_ID}/stories → GET /{STORY_ID}/insights?metric=views,reach; дополнительно navigation,link_clicks,replies','Основное окно 24 часа; опрос каждые 1–3 часа — предложение.','Небольшие значения могут вернуть code 10 Not enough viewers (менее 5). replies имеет ограничения для Европы/Японии. Highlights не считаем гарантией восстановления всех Stories. story_insights webhook в общем руководстве доступен только Facebook Login; не обещаем его для Unified/Instagram Login.'),
('Рекламные и органические результаты','Обычные media views/likes/comments — отдельно; total_views/total_likes/total_comments только по поддерживаемому Facebook Login. Для кампаний — отдельный Marketing API.','Разделяем в модели платформу, источники и способ входа.','Не переносим поддержку total_* на Unified Login только из-за общего host. Если реклама обязательна, выбираем/проверяем соответствующий маршрут и дополнительные права на пилоте.'),
('Вовлечённость в отчёте','Расчёт, например total_interactions / reach × 100%','Один объект и сопоставимый период.','Формула компании, а не универсальная метрика Meta. При неизвестном/нулевом знаменателе — N/A. Нельзя складывать показатели аккаунта и его публикаций как независимые значения.')
]) + '''<div class="callout gold"><strong>Общие ограничения</strong><p>Статистика относится к разрешённым профессиональным аккаунтам и их контенту; данные до перехода в профессиональный тип могут быть недоступны. Расчёт может запаздывать до 48 часов. Наличие 90 дней истории аккаунта не означает, что весь диапазон доступен для каждой метрики и одного запроса. Глубину первичной загрузки проверяем на пилоте и запрашиваем совместимыми окнами. Демографию и online_followers не включаем в обязательный набор: у них дополнительные пороги/периоды.</p></div>
<p class="source">Основание: <a href="#r6">Insights [6]</a>, <a href="#r7">аккаунт [7]</a>, <a href="#r8">медиа [8]</a>, <a href="#r10">профиль [10]</a>. Если примеры общего руководства расходятся с таблицей endpoint, используем текущую справку endpoint и подтверждаем пилотом.</p>''')

section('storage', 'Несколько аккаунтов и регулярное сохранение', '''
<p>Предлагаемый стек реализации: <strong>n8n как планировщик и HTTP-сборщик → PostgreSQL → текущая BI-система или таблица компании</strong>. Это архитектурное предложение, не обязательный стек из ТЗ. OAuth callback и хранилище секретов размещаются на сервере под контролем компании. Отчёт не получает токены.</p>
<p>Каждое бизнес-портфолио имеет отдельное подключение; несколько разрешённых аккаунтов одного портфолио могут использовать один SUAT. Очередь обрабатывает каждый IG ID отдельно, с ограничением параллельности и блокировкой одновременных запусков для одного аккаунта. Смена username не создаёт новый аккаунт; ключ — стабильный IG ID вместе с конфигурацией/подключением.</p>
''' + table(['Сущность','Основные поля','Назначение'], [
('connections','id, login_type, app_id, config_id, client_business_id, secret_ref, expires_at, status','Секрет отдельно; status connected / needs_reconnect / paused.'),
('accounts','connection_id, ig_id (text), username, timezone, owner, last_success_at','Привязка аккаунта и ответственного; изоляция доступа в общем отчёте.'),
('media','connection_id, ig_id, media_id (text), media_product_type, published_at, permalink','Пагинация /media и /stories до конца, справочник форматов.'),
('metrics','account_key, object_type/id, metric, period_start/end, aggregation, breakdown_key, value, unit, collected_at, api_version, availability','Уникальный ключ по объекту, метрике, границам, агрегации и breakdown; UPSERT без дублей. Для снимка добавляем дату/время снимка согласно выбранной частоте.'),
('sync_runs','run_id, account_key, started_at, finished_at, windows, status, attempts, error_code, trace_id','Журнал без секретов; checkpoint только для успешно сохранённой страницы/окна.')
]) + '''<h3>Предлагаемый регламент</h3><ul>
<li><strong>Ежедневно:</strong> subscribers сейчас; reach/views за завершённый день. Повторно загружаем последние 3 дня из-за задержки расчёта. Первичная история аккаунта — в доступном диапазоне до 90 дней по каждой метрике.</li>
<li><strong>Публикации:</strong> находим новые, обновляем свежие чаще, старые реже. Храним lifetime-снимки с датой. Изменение между снимками не выдаём за официальную суточную метрику.</li>
<li><strong>Stories:</strong> опрос каждые 1–3 часа, если включены в объём; только свежие объекты, без обещания полной старой истории.</li>
<li><strong>Надёжность:</strong> временные сетевые/5xx ошибки и лимиты — ограниченные повторы с exponential backoff и jitter, с учётом Retry-After и usage-заголовков Meta. Ошибки прав и параметров бесконечно не повторяем. Сбой одного аккаунта не прерывает другие.</li>
<li><strong>Данные:</strong> UTC в хранилище, согласованный бизнес-часовой пояс в отчёте. Сохраняем определения и единицы. Нормализованные данные и безопасный исходный payload помогают сверке; URL из paging с токеном в логи не пишем. «Нет данных» хранится статусом с NULL; настоящий 0 остаётся нулём.</li>
<li><strong>Мониторинг:</strong> показываем last_success_at и пропуски. Предлагаемый порог — уведомление, если ежедневная загрузка не завершилась в течение суток после согласованного времени. Канал уведомлений и допустимую задержку утверждает компания.</li>
</ul><p>Срок хранения в собственной базе, доступ сотрудников, удаление при отключении и резервные копии согласуются с компанией и правилами Meta. Сохранённая история не зависит от повторной доступности того же периода в API. Расписание адаптируем под количество аккаунтов и фактические лимиты; фиксированную универсальную квоту запросов не обещаем.</p>
<p class="source">Условия API: <a href="#r1">обзор [1]</a>, <a href="#r3">хранение токена [3]</a>, <a href="#r5">несколько портфолио [5]</a>, <a href="#r6">история [6]</a>. Модель БД и расписание — предложение автора.</p>''')

section('troubleshoot', 'Диагностика: симптом → проверка → действие', table(['Симптом','Что проверяем','Что делаем'], [
('Нет вкладки Unified Login','Принадлежность приложения бизнес-портфолио; Facebook Login for Business; роль администратора.','Исправить принадлежность/конфигурацию или выбрать подходящий альтернативный маршрут.'),
('Не виден нужный аккаунт','Business/Creator, выбранное портфолио, права владельца, принятие приглашения, выбор объектов. Для Facebook Login — связь Page ↔ IG.','Владелец исправляет права/выбор. Получить assigned_instagram_accounts и сверить с реестром компании.'),
('Нет варианта Instagram на входе','Совместимость config_id с Instagram; существующая Facebook-сессия.','Выбрать совместимую конфигурацию; prompt=login показывает варианты входа. Не менять scopes другого потока наугад.'),
('Ошибка callback или обмена code','Совпадение redirect URI, App ID/Secret правильного типа, state, свежесть и однократность code.','Исправить настройку; начать новый вход. Не записывать code/secret в журналы.'),
('Недействительный токен / OAuth code 190','Срок, отзыв, перенос профиля, соответствие app/host/login_type. Помощник Instagram может не понимать SUAT.','Для SUAT проверить прямым запросом нужного объекта. При отзыве/переносе остановить подключение и переподключить; исключить бесконечные повторы.'),
('Code 10/200: нет доступа','Текст и subcode ошибки, выданные scopes, Advanced Access, Live mode, роли, professional type, право на объект.','Сравнить с таблицей требований endpoint. Получить новое согласие при добавлении прав. Один code 10 сам по себе не определяет причину.'),
('Code 10: Not enough viewers','Формат STORY и конкретное сообщение о пороге зрителей.','Сохранить статус недостаточно данных; не считать это автоматически потерей всех прав или нулём просмотров.'),
('Пустой data / нет метрики / code 100','Поддержка metric, period, metric_type и breakdown для формата; даты, размер окна, возраст контента, пороги аудитории.','Разделить несовместимые запросы; повторить свежие данные позже; недоступность отмечать явно. Не заменять нулями.'),
('429 / rate-limit ошибка Graph / 5xx','HTTP и Graph error, usage-заголовки, параллельность, повторы/дубли планировщика.','Снизить нагрузку, ограничить очередь, backoff. После максимума попыток уведомить и сохранить checkpoint.'),
('Цифры отличаются от Instagram','Даты/UTC, дата сбора, органика/реклама, IG/Facebook, lifetime/день, задержка 48 часов, приблизительный reach.','Согласовать одинаковые определения; перечитать окно. Не исправлять числа вручную ради совпадения.'),
('Пилот работает, клиент не подключается','Роль администратора могла скрыть отсутствие Advanced Access.','Проверить Live mode и одобрение всех фактически запрашиваемых scopes; после approval протестировать пользователя без роли.')
]) + '''<p>Для поддержки фиксируем app_id, config_id, этап, безопасный ID объекта, время с зоной, код/subcode, fbtrace_id и сообщение без секретов. Пароли, токены, App Secret и полный OAuth URL не прикладываем. Ответственный за доступ — владелец; за повтор и техническое исправление — специалист.</p><p class="source">Основные причины подключения: <a href="#r11">официальная диагностика [11]</a>. Проверки метрик: <a href="#r7">[7]</a>, <a href="#r8">[8]</a>. Retry и журналирование — проектные решения.</p>''')

section('acceptance', 'План проверки и соответствие заданию', '''
<p>Ниже будущая приёмка интеграции. В этом тестовом задании проверяется полнота плана; реальные аккаунты и токены не запрашивались.</p>
''' + table(['Этап / исполнитель','Проверка','Критерий успеха'], [
('Подготовка · владелец + специалист','Сверить реестр профилей, professional type, портфолио, роли, корпоративное приложение.','Каждый аккаунт имеет ответственного и понятный маршрут подключения.'),
('Согласие · владелец','Проверить config_id, выбранные объекты и scopes, в том числе обязательное messages; отказ/отмена.','Нет несогласованных объектов и прав. При отмене подключение не создаётся.'),
('OAuth · специалист','Положительный вход, неверный/повторный state, повторный code, неправильный redirect URI.','Сохраняется только корректное подключение; секреты не появляются в интерфейсе/логах.'),
('Объекты · специалист + владелец','client_business_id, все страницы assigned_instagram_accounts; второй аккаунт и другое портфолио.','Реестр соответствует выбору; токен и бизнес привязаны правильно, лишние аккаунты отсутствуют.'),
('Метрики · специалист + маркетолог','followers_count, views/reach за завершённый период, один FEED/карусель, REELS и свежая Story при наличии.','Данные сопоставлены с Instagram с одинаковыми определениями; расхождения объяснены. Порог/отсутствие данных отмечены.'),
('Хранение · специалист','Повтор окна, повтор страницы, сбой после частичной записи, пустой data и настоящий 0.','Нет дублей и потери предыдущих успешных данных; есть статус доступности, единицы и время.'),
('Расписание · специалист','Два последовательных ежедневных цикла; перечитывание 3 дней; краткое окно Stories.','Сбор идёт автоматически, отчёт показывает свежесть и пропуски.'),
('Отказоустойчивость · специалист','Контролируемый 429/5xx, отзыв тестового доступа с согласия владельца, сбой одного аккаунта.','Ограниченные повторы, понятное уведомление, остальные аккаунты работают.'),
('Токены · специалист + владелец','Истечение/обновление выбранного типа токена; повторное согласие; отключение профиля.','Назначен регламент, доступ восстанавливается, отключённый аккаунт больше не собирается.'),
('Передача · компания','Подтвердить владельца системы, получателя уведомлений, период, KPI, хранение, инструкцию восстановления.','Компания принимает пилот и согласует подключение остальных аккаунтов.')
]) + '''<h3>Что передаём по ТЗ</h3><ul class="checklist">
<li>Визуальная схема: две SVG-схемы в бизнес-документе и последовательность технического подключения здесь.</li>
<li>Пошаговый план с владельцем, специалистом и автоматикой: бизнес-раздел 03; технические шаги 01–06 выше.</li>
<li>Таблица метрик с получением, условиями и периодами: раздел «Метрики» этого приложения.</li>
<li>План проверки всех этапов: таблица выше, включая отрицательные сценарии.</li>
<li>Вопросы компании: бизнес-раздел 08. Дополнительно согласовать обязательное messages в Unified Login, управление SUAT и наличие рекламы в показателях.</li>
</ul><div class="callout"><strong>Готовность задачи №2</strong><p>Комплект покрывает требуемое исследование и план. Реализация интеграции и получение реальных доступов не входят в объём этой задачи. При внедрении пилот подтверждает фактическую доступность данных каждого аккаунта.</p></div>''')

sources = [
('Instagram Platform Overview','overview','Типы аккаунтов, три маршрута, роли и уровни доступа.'),
('Unified Login · Get Started','instagram-api-with-unified-login/get-started','Конфигурация, обязательные scopes, OAuth, business ID и assigned accounts.'),
('Unified Login · Authentication','instagram-api-with-unified-login/authentication','SUAT, срок из конфигурации, отзыв и хранение.'),
('Unified Login · Permissions','instagram-api-with-unified-login/permissions','Права Insights и business_management для управления токенами.'),
('Unified Login · Business Onboarding','instagram-api-with-unified-login/business-onboarding','Выбор объектов и отдельные подключения портфолио.'),
('Instagram Platform Insights','insights','Требования, 90 дней истории, ограничения и три маршрута.'),
('Instagram Account Insights','api-reference/instagram-user/insights','Метрики аккаунта, параметры, пороги, views, reach и задержка.'),
('Instagram Media Insights','reference/instagram-media/insights','Форматы, lifetime, 2 года, Stories, реклама и региональные ограничения.'),
('Business Login for Instagram','instagram-api-with-instagram-login/business-login','Альтернативный OAuth; долгосрочный токен и refresh.'),
('IG User','instagram-graph-api/reference/ig-user','Поле followers_count и реестр media/stories.'),
('Unified Login · Eligibility & Troubleshooting','instagram-api-with-unified-login/eligibility-and-troubleshooting','Роли, конфигурация, отсутствие аккаунта, отзыв и перенос.')]
section('references', 'Проверенные источники', '''<p>Официальные страницы Meta прочитаны через браузер 7 ноября 2026 года. Часть запросов через поисковый инструмент возвращала HTTP 429; браузер позволил прочитать перечисленные страницы. Русский перевод Meta местами автоматический: названия scopes, параметров и API сохранены в оригинале. Ссылки требуют интернета, весь текст и схемы доступны офлайн.</p><ol class="ref-list">''' + ''.join(f'<li id="r{i}"><a href="https://developers.facebook.com/documentation/instagram-platform/{path}" target="_blank" rel="noopener">Meta · {title}</a><br>{desc}</li>' for i,(title,path,desc) in enumerate(sources,1)) + '''</ol><p class="small muted">Исходный объём: задача №2, страница 2 документа LD_LATTE_test_automation.pdf. Расписание, модель хранения и порядок приёмки предложены автором; ограничения API отнесены к источникам. Технические условия повторно сверяются перед реальным запуском.</p>''')

nav = ''.join(f'<a href="#{id}">{i:02} · {title}</a>' for i,(id,title,_) in enumerate(sections,1))
body = ''.join(f'<section id="{id}"><div class="section-title"><span class="num">{i:02}</span><h2>{title}</h2></div>{content}</section>' for i,(id,title,content) in enumerate(sections,1))
html = f'''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LD LATTE — Instagram: техническое приложение</title><style>{css}</style></head><body><div class="shell" id="top"><header class="masthead"><div class="brand">LD LATTE</div><a href="index.html">← План для бизнеса</a><button class="print" onclick="window.print()">Печать / PDF ↗</button></header><div class="hero"><div class="eyebrow">Задача 02 · Приложение для специалиста</div><h1>От согласия владельца<br>до <em>первой метрики</em></h1><p class="lead">Разрешения, токены, запросы, хранение и проверка. Подробности внедрения дополняют понятный бизнес-план.</p><div class="chips"><span class="chip">Проверено 07.11.2026</span><span class="chip">Unified Login · v27.0</span><span class="chip">Реальные доступы не требуются</span></div></div><div class="layout"><aside class="sidebar"><div class="eyebrow">Технический маршрут</div><nav aria-label="Содержание приложения">{nav}</nav></aside><main>{body}<a class="backtop" href="#top">К началу ↑</a></main></div><footer class="footer"><span>LD LATTE / Задача №2 · Техническое приложение</span><span>Версия 1.2 · 07.11.2026</span></footer></div></body></html>'''
(ROOT / 'technical.html').write_text(html, encoding='utf-8')
print('Built technical.html:', len(sections), 'sections;', len(sources), 'primary sources.')
