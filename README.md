# Игры с числами — VK Mini App

Готовая версия для хранения в приватном GitHub-репозитории и автоматической публикации в VK Hosting.

## Уже настроено

- VK Mini App ID: `54804062`
- VK community ID: `242008653`
- Yandex Metrika ID: `113396208`
- VK Hosting config: `vk-hosting-config.json`
- GitHub Actions workflow: `.github/workflows/deploy.yml`

## Что нужно сделать один раз в GitHub

1. Создать пустой приватный репозиторий.
2. Загрузить в него **всё содержимое этой папки**, включая папку `.github` и файл `.gitignore`.
3. Открыть: **Settings → Secrets and variables → Actions → New repository secret**.
4. Создать secret с точным именем:
   `MINI_APPS_ACCESS_TOKEN`
5. В значение вставить сервисный токен VK-приложения. Не публиковать этот токен и не добавлять его в файлы проекта.
6. После сохранения секрета открыть вкладку **Actions**. Workflow `Deploy to VK Mini Apps` должен запуститься автоматически после загрузки файлов. Его также можно запустить вручную через **Run workflow**.

## Как будут выходить обновления

Любое изменение, сохранённое в ветке `main`, автоматически запускает сборку и публикацию в VK Hosting.

## Локальный запуск необязателен

Если всё же понадобится запуск на компьютере:

```bash
npm install
npm run dev
```

Для локального запуска можно скопировать `.env.example` в `.env`.
