#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -v reader_password="$BOT_DB_PASSWORD" <<'SQL'
CREATE SCHEMA catalog;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE TABLE catalog.services (
  id uuid PRIMARY KEY,
  name varchar(200) NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE ROLE latte_reader LOGIN PASSWORD :'reader_password';
GRANT CONNECT ON DATABASE latte_catalog TO latte_reader;
GRANT USAGE ON SCHEMA catalog TO latte_reader;
GRANT SELECT ON catalog.services TO latte_reader;
INSERT INTO catalog.services(id,name,active,sort_order) VALUES
('00000000-0000-4000-8000-000000000001','Бот для записи клиентов',true,1),
('00000000-0000-4000-8000-000000000002','Интеграция CRM с сайтом',true,2),
('00000000-0000-4000-8000-000000000003','Ежедневный отчёт о продажах',false,3),
('00000000-0000-4000-8000-000000000004','Уведомления о новых заявках',false,4),
('00000000-0000-4000-8000-000000000005','Синхронизация остатков',false,5),
('00000000-0000-4000-8000-000000000006','Напоминания о встречах',false,6),
('00000000-0000-4000-8000-000000000007','Сбор обратной связи',false,7),
('00000000-0000-4000-8000-000000000008','Выгрузка заказов в таблицу',false,8),
('00000000-0000-4000-8000-000000000009','Проверка качества данных',false,9);
SQL
