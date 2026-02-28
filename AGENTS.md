# Agent Instructions

## E2E Tests

End-to-end tests **must** be run after any changes to the geometry field view, geometry aggregate field view, aggregation panel, or related metadata/layout logic.

### Test files

| File | Purpose |
|---|---|
| `e2e/tests/installed-extension.smoke.spec.js` | Verifies the extension installs and appears in admin |
| `e2e/tests/geometry-aggregate.spec.js` | Verifies geometry fields, aggregate maps, API data flow, and popup links |

### Running E2E tests locally (Docker)

The full pipeline builds a clean EspoCRM instance in Docker, installs the extension as a packaged zip, and runs Playwright tests against it.

```bash
# 1. Start Docker services (DB + app)
npm run e2e:docker:up

# 2. Prepare the installed extension environment (builds zip, installs in Docker)
npm run e2e:prepare-installed

# 3. Run the tests
npm run e2e:test

# 4. (Optional) Run headed for visual debugging
npm run e2e:test:headed

# 5. Stop Docker when done
npm run e2e:docker:down
```

### Running E2E tests against an existing dev instance

If you already have a local dev instance running at `http://localhost:8080` (via `npm run all` or `docker compose up`):

```bash
# Sync latest code and rebuild
npm run copy
docker compose exec app php site/rebuild.php

# Run tests directly (no need for full prepare step)
npx playwright test
```

Override the base URL or credentials with environment variables:

```bash
ESPO_E2E_BASE_URL=http://localhost:8080 \
ESPO_E2E_ADMIN_USERNAME=admin \
ESPO_E2E_ADMIN_PASSWORD=1 \
npx playwright test
```

### What the geometry-aggregate test covers

1. **Entity/field setup** -- creates CParcel entity, geometry field, Account relationship, and geometryAggregate field via API
2. **Layout configuration** -- sets detail layouts so geometry fields are visible
3. **Parcel detail map** -- verifies the Leaflet map renders on a CParcel record
4. **Aggregate map on Account** -- verifies the geometry aggregate field loads on the Account detail view
5. **API data flow** -- intercepts the related-records API call and verifies geometry data is returned
6. **List view badges** -- verifies geometry type badges appear in CParcel list view
7. **Popup links** -- verifies clicking a geometry on the aggregate map shows a popup linking to the child record

### When to run

- After modifying `src/files/client/custom/modules/geo-spatial/src/views/fields/geometry.js`
- After modifying `src/files/client/custom/modules/geo-spatial/src/views/fields/geometry-aggregate.js`
- After modifying `src/files/client/custom/modules/geo-spatial/src/views/record/panels/geo-aggregate-map.js`
- After modifying `src/files/client/custom/modules/geo-spatial/src/lib/map-utils.js`
- After modifying `src/files/custom/Espo/Modules/GeoSpatial/Resources/metadata/fields/geometry.json`
- After modifying `src/files/custom/Espo/Modules/GeoSpatial/Resources/metadata/fields/geometryAggregate.json`
- After modifying `src/files/custom/Espo/Modules/GeoSpatial/Classes/Rebuild/GeoAggregatePanelConfig.php`
