# Packaged-install E2E

This E2E setup validates the extension as a real packaged artifact (`.zip`) installed into a clean EspoCRM instance.

## Docker-first workflow (default)

`npm run e2e:packaged` now uses Docker Compose and performs:

1. Start `db` + `app` services (`docker compose up -d --build db app`)
2. Install project dependencies inside `app` container (`npm ci`)
3. Prepare clean Espo and install extension from built zip
4. Run Playwright tests from host machine

### Commands

```bash
# one-time browser install on host
npm run e2e:install-browsers

# full packaged install + tests (default)
npm run e2e:packaged

# manage stack manually if needed
npm run e2e:docker:up
npm run e2e:docker:logs
npm run e2e:docker:down
```

## Optional Docker env vars

- `E2E_APP_PORT` (default `8080`)
- `E2E_DB_PORT` (default `3307`)
- `E2E_DB_NAME` (default `ext-geo-spatial`)
- `E2E_DB_USER` (default `espocrm`)
- `E2E_DB_PASSWORD` (default `espocrm`)
- `E2E_DB_ROOT_PASSWORD` (default `root`)
- `E2E_SITE_URL` (default `http://localhost:8080`)

## Local fallback workflow

If you want to run without Docker, use:

```bash
npm run e2e:packaged:local
```

This requires local PHP, Composer, MySQL, and related toolchain.

## Playwright auth env vars

- `ESPO_E2E_BASE_URL` (default: `http://127.0.0.1:8080`)
- `ESPO_E2E_ADMIN_USERNAME` (default: `admin`)
- `ESPO_E2E_ADMIN_PASSWORD` (default: `1`)
