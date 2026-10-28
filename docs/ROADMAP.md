# APC: план переписывания

Новая версия albion-profit-calculator: фронт и бэк в одном репозитории, данные о предметах и рецептах генерируются из [ao-bin-dumps](https://github.com/ao-data/ao-bin-dumps) вместо ручных JSON.

## Стек

| Слой        | Выбор                                    | Комментарий                                                                                     |
| ----------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Монорепо    | pnpm workspaces, Node 24 LTS, TypeScript |                                                                                                 |
| Фронт       | React 19 + Vite, React Router 7          | роутер уже знакомый по скелету                                                                  |
| UI          | HeroUI + Tailwind                        |                                                                                                 |
| Состояние   | Zustand + TanStack Query                 | Zustand: настройки (persist) и UI-состояние; Query: цены с сервера (кэш, дедупликация, refetch) |
| Таблицы     | TanStack Table + TanStack Virtual        | деревья и таблицы на сотни строк                                                                |
| i18n        | i18next                                  | названия предметов из `formatted/items.json`, UI-строки руками                                  |
| API         | Hono + zod                               | типизированный клиент для фронта через Hono RPC                                                 |
| БД          | PostgreSQL + Drizzle                     | локально без Docker: PGlite или портативный Postgres                                            |
| Авторизация | better-auth                              | Discord OAuth + вход по нику/паролю для мигрированных пользователей                             |
| Цены        | свой ingest из NATS (`nats` v2)          | серверы West / East / Europe + приватные серверы                                                |
| Тесты       | Vitest                                   | обязательно для `game-data` и `calc`                                                            |
| Деплой      | systemd/pm2 + Caddy, поддомен beta       | без Docker, как текущий прод                                                                    |

## Структура

```
apps/
  web/        фронт
  api/        HTTP API
  ingest/     NATS → Postgres, cron (средние цены, перевозки)
packages/
  game-data/  парсер дампов → каталог (предметы, рецепты, категории, локализации)
  calc/       формулы профита, чистый TS без UI
  shared/     общие типы и контракт API
```

## Этапы

### 0. Фундамент

- pnpm workspaces, общие tsconfig/eslint (flat config)/prettier, Vitest.
- Перенести текущий Vite-скелет в `apps/web`, заменить Gravity UI на HeroUI + Tailwind.
- CI в GitHub Actions: lint, typecheck, test.

### 1. game-data: каталог из дампов

Принцип: модель каталога повторяет модель дампов, без собственных эвристик. Парсер только нормализует формат, а не придумывает структуру.

- Зафиксировать коммит ao-bin-dumps (submodule или скрипт загрузки по хешу).
- `pnpm data:build`: `items.json` + `formatted/items.json` → каталог, версия = дата дампов.
- Нормализация, и только она:
    - `@attr` → camelCase, числа и булевы из строк;
    - «объект или массив» → всегда массив (`craftingrequirements`, `craftresource`, `enchantment`);
    - выкинуть неэкономические поля (спеллы, звуки, анимации, статы боя).
- Сохранить исходные сущности как есть:
    - тип предмета по разделу дампа (`weapon`, `equipmentitem`, `simpleitem`, `consumableitem`, `journalitem`, …);
    - `craftingrequirements` — массив всех вариантов рецепта (обычный, с фракционными токенами, с `ARTEFACT_TOKEN_FAVOR`); какой вариант считать, решает `calc` и настройки пользователя, а не парсер;
    - `enchantments` — вложены в базовый предмет, у каждого уровня свои `craftingrequirements` и `upgraderequirements` (руны/души/реликвии);
    - зачарованные ресурсы — отдельные предметы (`T4_METALBAR_LEVEL1`) с `enchantmentLevel`;
    - `craftresource.maxReturnAmount`, `amountCrafted`, `craftingFocus`, `silver`, `itemValue` — как в дампе.
- Дерево категорий — напрямую из `shopcategories` (`shopcategory` → `shopsubcategory` → `shopsubcategory2`, порядок по `@value`) вместо `profitTreeItemsTree.json`.
- Локализация — из `formatted/items.json` (`LocalizedNames` по всем языкам, ключ `UniqueName` с `@N`).
- TS-типы описывают модель дампа; zod-схемы валидируют её при сборке, чтобы изменения формата после патчей ловились сразу.
- Отдавать фронту статикой по чанкам с хешем в имени.
- Иконки пока напрямую с `render.albiononline.com` (lazy loading); позже свой кэш со сжатием, чтобы не ловить 429.

### 2. calc: формулы

- Перенести расчёты из старых сторов (`profit-tree/getters`, refining, food-and-potions, transmutations, artifact-foundry) в чистые функции.
- Golden-тесты: одинаковые входные цены → такие же числа, как в старом приложении.

### 3. Бэк: цены

- `apps/api`: Hono + Drizzle, схема: `users`, `accounts`, `servers`, `user_settings`, `market_orders`, `best_prices`.
- `apps/ingest`: подписка на NATS (West / East / Europe), батчевый upsert, обновление `best_prices`, TTL ордеров.
- Cron средних цен из AODP charts API.
- Эндпоинт цен по набору предметов/городов/качеств.

### 4. Авторизация и миграция

- better-auth: вход через Discord для новых пользователей.
- Мигрированные пользователи входят по нику/паролю (bcrypt-хеши переносятся как есть) и могут привязать Discord.
- Скрипт миграции из Mongo: `users` (nickname, password, role, dtCreated), настройки дерева, приватные серверы.
- Роли: user / supporter / admin.

### 5. Каркас фронта

- Layout, сайдбар, тема, i18n, выбор сервера, вход и профиль.

### 6. Разделы (по порядку)

1. Переработка: самый простой раздел, на нём обкатываем связку каталог → цены → calc → UI.
2. Дерево профита.
3. Еда и зелья.
4. Цех артефактов.
5. Трансмутации.
6. Перевозки: нужен воркер нормализованных цен в `ingest`.
7. Серверы (приватные NATS).
8. Админка, FAQ.

### 7. Beta

- Деплой на beta-поддомен: Postgres, api, ingest под systemd/pm2, Caddy.
- Ingest работает параллельно со старым продом.
- Сбор фидбека, затем переключение основного домена.
