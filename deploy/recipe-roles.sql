-- Роли и права БД книги рецептов (ADR-0012). Идемпотентно: можно запускать повторно.
-- Запуск (суперпользователем, psql):
--   psql -v ON_ERROR_STOP=1 -v dbname=recipe \
--        -v app_password=... -v migrator_password=... -f deploy/recipe-roles.sql
-- Init-скрипты Postgres срабатывают только на пустой базе, поэтому на проде этот файл
-- запускается явно при каждом изменении ролей.

-- recipe_owner — владелец схемы, войти им нельзя.
SELECT 'CREATE ROLE recipe_owner NOLOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'recipe_owner') \gexec

-- recipe_migrator — логин для миграций, работает от имени владельца.
SELECT 'CREATE ROLE recipe_migrator LOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'recipe_migrator') \gexec
SELECT format('ALTER ROLE recipe_migrator LOGIN PASSWORD %L', :'migrator_password') \gexec
GRANT recipe_owner TO recipe_migrator;
ALTER ROLE recipe_migrator SET statement_timeout = '5min';
ALTER ROLE recipe_migrator SET lock_timeout = '5s';
ALTER ROLE recipe_migrator SET idle_in_transaction_session_timeout = '60s';

-- recipe_app — рантайм сайта: только чтение и запись данных, без DDL.
SELECT 'CREATE ROLE recipe_app LOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'recipe_app') \gexec
SELECT format('ALTER ROLE recipe_app LOGIN PASSWORD %L', :'app_password') \gexec
ALTER ROLE recipe_app SET statement_timeout = '15s';
ALTER ROLE recipe_app SET lock_timeout = '3s';
ALTER ROLE recipe_app SET idle_in_transaction_session_timeout = '30s';

-- База: подключаться могут только наши роли; создавать схемы — только владелец (схема drizzle).
REVOKE ALL ON DATABASE :"dbname" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"dbname" TO recipe_migrator, recipe_app;
GRANT CREATE, TEMPORARY ON DATABASE :"dbname" TO recipe_owner;

-- Схема public: создаёт объекты только владелец, приложение — только пользуется.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO recipe_owner;
GRANT USAGE ON SCHEMA public TO recipe_app;

-- Всё, что владелец создаст, приложению доступно только на DML.
ALTER DEFAULT PRIVILEGES FOR ROLE recipe_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO recipe_app;
ALTER DEFAULT PRIVILEGES FOR ROLE recipe_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO recipe_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO recipe_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO recipe_app;
