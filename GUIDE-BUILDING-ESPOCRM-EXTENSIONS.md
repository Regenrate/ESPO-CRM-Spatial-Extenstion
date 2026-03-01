# Building an EspoCRM Extension with End-to-End Testing

A complete, step-by-step reference for an LLM agent to scaffold, develop, and test an EspoCRM extension. Every file path, naming convention, and configuration value is specified exactly. Follow the sections in order.

---

## Table of Contents

1. [Prerequisites & Toolchain](#1-prerequisites--toolchain)
2. [Project Scaffold](#2-project-scaffold)
3. [Extension Manifest — `extension.json`](#3-extension-manifest--extensionjson)
4. [Build Entry Point — `build.js`](#4-build-entry-point--buildjs)
5. [Development Configuration](#5-development-configuration)
6. [Backend: PHP Module Structure](#6-backend-php-module-structure)
7. [Backend: Metadata (Field Types, App Config, Rebuild Actions)](#7-backend-metadata-field-types-app-config-rebuild-actions)
8. [Backend: PHP Classes](#8-backend-php-classes)
9. [Backend: Translations (i18n)](#9-backend-translations-i18n)
10. [Backend: Install Script](#10-backend-install-script)
11. [Frontend: Client-Side Module Structure](#11-frontend-client-side-module-structure)
12. [Frontend: Field Views](#12-frontend-field-views)
13. [Frontend: Panel Views](#13-frontend-panel-views)
14. [Frontend: Bundling Third-Party Libraries](#14-frontend-bundling-third-party-libraries)
15. [Frontend: CSS and Assets](#15-frontend-css-and-assets)
16. [npm Scripts](#16-npm-scripts)
17. [Docker E2E Environment](#17-docker-e2e-environment)
18. [E2E Preparation Scripts](#18-e2e-preparation-scripts)
19. [Playwright Configuration](#19-playwright-configuration)
20. [Writing E2E Tests](#20-writing-e2e-tests)
21. [Running the Full Pipeline](#21-running-the-full-pipeline)
22. [Naming Conventions Reference](#22-naming-conventions-reference)
23. [Common Pitfalls](#23-common-pitfalls)

---

## 1. Prerequisites & Toolchain

| Tool | Minimum Version | Purpose |
|---|---|---|
| Node.js | >= 18 | Build tooling, scripts, Playwright |
| npm | >= 8 | Package management |
| PHP | >= 8.1 | EspoCRM runtime |
| Composer | latest | PHP dependency management (used by `espo-extension-tools`) |
| MySQL | 8.0 | Database for EspoCRM |
| Docker + Docker Compose | latest | Isolated E2E test environment |
| Playwright | latest | Browser-based E2E testing |

---

## 2. Project Scaffold

### 2.1 Directory layout

Create this exact directory structure. Replace `{ModuleName}` with your PascalCase module name (e.g., `GeoSpatial`) and `{module-name}` with its kebab-case equivalent (e.g., `geo-spatial`).

```
project-root/
├── build.js                              # Build entry point (3 lines)
├── config-default.json                   # Default dev config template
├── config.json                           # Local dev config (gitignored)
├── docker-compose.yml                    # Docker services for E2E
├── extension.json                        # Extension manifest
├── jsconfig.json                         # IDE path mappings
├── package.json                          # npm config, scripts, deps
├── rollup.config.mjs                     # (Optional) Bundle third-party libs
├── .gitignore
├── .env.e2e.example                      # Example E2E env vars
├── playwright.config.mjs                 # Playwright config
│
├── docker/
│   └── e2e/
│       └── app.Dockerfile                # PHP+Node+Apache image
│
├── e2e/
│   └── tests/
│       ├── installed-extension.smoke.spec.js   # Smoke: extension appears in admin
│       └── {your-feature}.spec.js              # Feature-specific E2E tests
│
├── php_scripts/
│   └── merge_configs.php                 # Required no-op for espo-extension-tools
│
├── scripts/
│   └── e2e/
│       ├── prepare-installed-extension.mjs         # Local prep script
│       └── prepare-installed-extension-docker.mjs  # Docker prep script
│
└── src/
    ├── files/
    │   ├── client/
    │   │   └── custom/
    │   │       └── modules/
    │   │           └── {module-name}/
    │   │               ├── css/           # Stylesheets
    │   │               ├── lib/           # Bundled third-party JS (AMD format)
    │   │               └── src/
    │   │                   ├── lib/       # Shared JS utilities
    │   │                   └── views/
    │   │                       ├── fields/       # Field view classes
    │   │                       └── record/
    │   │                           └── panels/   # Panel view classes
    │   │
    │   └── custom/
    │       └── Espo/
    │           └── Modules/
    │               └── {ModuleName}/
    │                   ├── Classes/
    │                   │   ├── FieldValidators/   # Server-side validation
    │                   │   └── Rebuild/           # Rebuild action classes
    │                   └── Resources/
    │                       ├── module.json
    │                       ├── i18n/
    │                       │   └── en_US/
    │                       │       ├── Admin.json
    │                       │       └── {ModuleName}.json
    │                       └── metadata/
    │                           ├── app/
    │                           │   ├── client.json
    │                           │   ├── jsLibs.json
    │                           │   └── rebuild.json
    │                           └── fields/
    │                               └── {fieldType}.json
    │
    └── scripts/
        └── AfterInstall.php              # Post-install hook
```

### 2.2 `package.json`

```json
{
  "name": "espocrm-ext-{module-name}",
  "version": "0.1.0",
  "description": "Description of your EspoCRM extension",
  "type": "module",
  "scripts": {
    "copy": "node build --copy",
    "composer-install": "node build --composer-install",
    "sync": "node build --copy && node build --composer-install",
    "extension": "node build --extension",
    "clear-cache": "php site/clear_cache.php",
    "rebuild": "node build --rebuild",
    "all": "node build --all",
    "prepare-test": "node build --prepare-test",
    "bundle-libs": "npx rollup -c rollup.config.mjs",
    "e2e:install-browsers": "playwright install chromium",
    "e2e:docker:up": "docker compose up -d --build db app",
    "e2e:docker:down": "docker compose down -v",
    "e2e:docker:logs": "docker compose logs -f app db",
    "e2e:prepare-installed:local": "node scripts/e2e/prepare-installed-extension.mjs",
    "e2e:prepare-installed": "node scripts/e2e/prepare-installed-extension-docker.mjs",
    "e2e:test": "playwright test",
    "e2e:test:headed": "playwright test --headed",
    "e2e:packaged:local": "npm run e2e:prepare-installed:local && npm run e2e:test",
    "e2e:packaged": "npm run e2e:prepare-installed && npm run e2e:test"
  },
  "author": "Your Name",
  "dependencies": {
    "espo-extension-tools": "github:espocrm/extension-tools#0.3.6",
    "fs-extra": "^9.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.58.2"
  },
  "engines": {
    "npm": ">=8",
    "node": ">=18"
  }
}
```

**Critical:** The `espo-extension-tools` package provides the `buildGeneral()` function that handles cloning EspoCRM, copying extension files, building the zip, and installing. Pin a specific tag.

### 2.3 `.gitignore`

```
node_modules/
site/
build/
config.json
.env.e2e
*.log
.DS_Store

# Playwright
playwright-report/
playwright/.cache/
test-results/
.playwright-cli/
```

### 2.4 `.env.e2e.example`

```
E2E_APP_PORT=8080
E2E_DB_PORT=3307
E2E_DB_NAME=ext-{module-name}
E2E_DB_USER=espocrm
E2E_DB_PASSWORD=espocrm
E2E_DB_ROOT_PASSWORD=root
E2E_SITE_URL=http://localhost:8080
E2E_ADMIN_USERNAME=admin
E2E_ADMIN_PASSWORD=1
```

### 2.5 `jsconfig.json`

Provides IDE path resolution so imports like `views/fields/base` resolve correctly during development.

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "modules/{module-name}/*": ["src/files/client/custom/modules/{module-name}/src/*"],
      "views/*": ["site/client/src/views/*"],
      "helpers/*": ["site/client/src/helpers/*"],
      "lib!*": ["site/client/lib/*"]
    }
  },
  "include": [
    "src/files/client/**/*.js"
  ]
}
```

### 2.6 `php_scripts/merge_configs.php`

Required by `espo-extension-tools`. Can be a no-op:

```php
<?php
// Required by espo-extension-tools. No custom config merging needed.
```

---

## 3. Extension Manifest — `extension.json`

This file defines the extension identity and is read by both `espo-extension-tools` (for building) and EspoCRM (during installation).

```json
{
  "module": "{ModuleName}",
  "name": "{ModuleName}",
  "description": "Human-readable description of the extension",
  "author": "Your Name or Organization",
  "bundled": true,
  "acceptableVersions": [
    ">=8.0.0"
  ],
  "php": [
    ">=8.1"
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `module` | string | PascalCase module name. Must match the directory name under `Espo/Modules/`. |
| `name` | string | Display name shown in EspoCRM admin. |
| `description` | string | Shown in EspoCRM admin extensions page. |
| `bundled` | boolean | If `true`, JS files under `src/` are transpiled/bundled by EspoCRM's build. Set to `true` for ES module syntax. |
| `acceptableVersions` | string[] | EspoCRM version constraints. |
| `php` | string[] | PHP version constraints. |
| `scripts` | string[] | (Optional) Shell commands run during `npm run extension` build, before packaging. Use for asset compilation (e.g., Rollup). |

If your extension bundles third-party JS libraries via Rollup, add:

```json
{
  "scripts": [
    "npx rollup -c rollup.config.mjs"
  ],
  "bundle": {
    "requires": ["your-lib-amd-id"]
  }
}
```

---

## 4. Build Entry Point — `build.js`

```javascript
import {buildGeneral} from 'espo-extension-tools';

buildGeneral();
```

This single file exposes the CLI commands: `node build --copy`, `node build --extension`, `node build --all`, etc.

---

## 5. Development Configuration

### 5.1 `config-default.json` (committed to git)

```json
{
  "espocrm": {
    "repository": "https://github.com/espocrm/espocrm.git",
    "branch": "stable"
  },
  "database": {
    "host": "localhost",
    "port": null,
    "charset": "utf8mb4",
    "dbname": "ext-{module-name}",
    "user": "root",
    "password": ""
  },
  "install": {
    "language": "en_US",
    "defaultOwner": "www-data",
    "defaultGroup": "www-data",
    "siteUrl": "http://localhost/ext-{module-name}/site",
    "adminUsername": "admin",
    "adminPassword": "1"
  }
}
```

### 5.2 `config.json` (gitignored, created by developer)

Copy from `config-default.json` and customize database credentials and `siteUrl`.

---

## 6. Backend: PHP Module Structure

All PHP code lives under:

```
src/files/custom/Espo/Modules/{ModuleName}/
```

The namespace is `Espo\Modules\{ModuleName}`.

### 6.1 `Resources/module.json`

```json
{
    "order": 30,
    "bundled": true,
    "jsTranspiled": true
}
```

| Field | Description |
|---|---|
| `order` | Load order (higher = loaded later). Use 30 for most extensions. |
| `bundled` | Must be `true` if `extension.json` has `"bundled": true`. |
| `jsTranspiled` | Set to `true` when using ES module syntax in frontend JS files. |

---

## 7. Backend: Metadata (Field Types, App Config, Rebuild Actions)

All metadata files live under `Resources/metadata/`. EspoCRM merges these into its global metadata at runtime.

### 7.1 Defining a custom field type — `Resources/metadata/fields/{fieldType}.json`

Use camelCase for field type names (e.g., `geometry`, `geometryAggregate`).

```json
{
    "view": "modules/{module-name}/views/fields/{field-name}",
    "params": [
        {
            "name": "someParam",
            "type": "int",
            "default": 400
        },
        {
            "name": "required",
            "type": "bool",
            "default": false
        }
    ],
    "validationList": ["required", "valid"],
    "mandatoryValidationList": ["valid"],
    "validatorClassName": "Espo\\Modules\\{ModuleName}\\Classes\\FieldValidators\\{ValidatorClass}",
    "columnType": "text",
    "fieldDefs": {
        "type": "text",
        "dbType": "mediumtext"
    },
    "filter": false,
    "notSortable": true,
    "textFilter": false,
    "textFilterForeign": false,
    "fullTextSearch": false
}
```

**Key fields explained:**

| Field | Description |
|---|---|
| `view` | Path to the client-side view class (without `.js` extension). Uses the `modules/{module-name}/` prefix. |
| `params` | Array of configuration parameters shown in Entity Manager when creating the field. |
| `validationList` | Validations that can be enabled per-field instance. |
| `mandatoryValidationList` | Validations always enforced. |
| `validatorClassName` | Fully-qualified PHP class for server-side validation. Use double backslashes in JSON. |
| `columnType` | How EspoCRM maps this to a database column. |
| `fieldDefs` | ORM column definition overrides. |

For a **virtual (non-stored) field** (like an aggregate), use:

```json
{
    "view": "modules/{module-name}/views/fields/{field-name}",
    "params": [...],
    "fieldDefs": {
        "type": "varchar",
        "notStorable": true,
        "readOnly": true
    },
    "filter": false,
    "notSortable": true,
    "directAccessDisabled": true,
    "importDisabled": true,
    "exportDisabled": true
}
```

### 7.2 Registering CSS and JS — `Resources/metadata/app/client.json`

```json
{
    "cssList": [
        "__APPEND__",
        "client/custom/modules/{module-name}/css/your-styles.css"
    ],
    "scriptList": [
        "__APPEND__",
        "client/custom/modules/{module-name}/lib/init.js"
    ]
}
```

**Critical:** The `"__APPEND__"` string tells EspoCRM to append to the existing list rather than replace it. Always include it as the first element.

### 7.3 Registering JS libraries — `Resources/metadata/app/jsLibs.json`

Register AMD modules so they can be imported via `define()` or ES `import`:

```json
{
    "your-lib-id": {
        "path": "client/custom/modules/{module-name}/lib/your-lib.js",
        "exportsTo": "window",
        "exportsAs": "YourGlobal"
    }
}
```

| Field | Description |
|---|---|
| `path` | Path relative to the EspoCRM web root. |
| `exportsTo` | Where to attach the export. Typically `"window"`. |
| `exportsAs` | Global variable name. |

### 7.4 Registering rebuild actions — `Resources/metadata/app/rebuild.json`

```json
{
    "actionClassNameList": [
        "__APPEND__",
        "Espo\\Modules\\{ModuleName}\\Classes\\Rebuild\\YourRebuildAction"
    ]
}
```

Rebuild actions run when an admin clicks Administration > Rebuild or when `php command.php rebuild` is invoked.

---

## 8. Backend: PHP Classes

### 8.1 Field validator

**Path:** `src/files/custom/Espo/Modules/{ModuleName}/Classes/FieldValidators/{ValidatorName}.php`

```php
<?php

namespace Espo\Modules\{ModuleName}\Classes\FieldValidators;

use Espo\Core\FieldValidation\Validator;
use Espo\Core\FieldValidation\Validator\Data;
use Espo\ORM\Entity;

/**
 * @implements Validator<Entity>
 */
class {ValidatorName} implements Validator
{
    public function validate(Entity $entity, string $field, Data $data): bool
    {
        // Return true if valid, false if invalid.
        $value = $entity->get($field);

        if ($value === null || $value === '') {
            return true; // Empty values are handled by 'required' validation
        }

        // Your validation logic here
        return true;
    }
}
```

**Note:** EspoCRM calls `checkRequired()` and `check{ValidationName}()` methods by convention. For the `valid` validation, the method is `checkValid()`. See the actual validator pattern:

```php
<?php

namespace Espo\Modules\{ModuleName}\Classes\FieldValidators;

use Espo\ORM\Entity;

class {ValidatorName}
{
    public function checkRequired(Entity $entity, string $field): bool
    {
        $value = $entity->get($field);
        return $value !== null && $value !== '';
    }

    public function checkValid(Entity $entity, string $field): bool
    {
        $value = $entity->get($field);

        if ($value === null || $value === '') {
            return true;
        }

        // Validate structure, return false if invalid
        return true;
    }
}
```

### 8.2 Rebuild action

**Path:** `src/files/custom/Espo/Modules/{ModuleName}/Classes/Rebuild/{ActionName}.php`

```php
<?php

namespace Espo\Modules\{ModuleName}\Classes\Rebuild;

use Espo\Core\Rebuild\RebuildAction;
use Espo\Core\Utils\Metadata;
use Espo\Core\Utils\DataCache;

class {ActionName} implements RebuildAction
{
    public function __construct(
        private Metadata $metadata,
        private DataCache $dataCache,
    ) {}

    public function process(): void
    {
        // Read metadata, compute derived configuration,
        // write custom metadata files.
        //
        // Example: scan entityDefs for certain field types,
        // then register UI panels on related entities.
    }
}
```

Rebuild actions are used to auto-generate metadata that depends on the current state of entity definitions (e.g., auto-registering UI panels when relationships exist).

---

## 9. Backend: Translations (i18n)

### 9.1 Admin field type labels — `Resources/i18n/en_US/Admin.json`

```json
{
    "fieldTypes": {
        "{fieldType}": "Human-Readable Field Type Name"
    }
}
```

This makes the field type name appear in Entity Manager's "Create Field" dialog.

### 9.2 Module-specific labels — `Resources/i18n/en_US/{ModuleName}.json`

```json
{
    "labels": {
        "someLabel": "Some Label"
    },
    "fields": {
        "someField": "Some Field"
    },
    "tooltips": {
        "someField": "Tooltip text for the field"
    },
    "options": {
        "someField": {
            "Option1": "Option 1 Label",
            "Option2": "Option 2 Label"
        }
    }
}
```

---

## 10. Backend: Install Script

**Path:** `src/scripts/AfterInstall.php`

```php
<?php

use Espo\Core\Container;
use Espo\Core\DataManager;

class AfterInstall
{
    public function run(Container $container): void
    {
        $dataManager = $container->getByClass(DataManager::class);
        $dataManager->rebuild();
    }
}
```

**Rules:**
- The class name must be `AfterInstall` (exact).
- The file must be at `src/scripts/AfterInstall.php` (exact).
- It runs once when the extension zip is installed via the EspoCRM admin UI.
- Always call `rebuild()` to ensure metadata caches are refreshed.

There is also an optional `AfterUninstall.php` with the same pattern.

---

## 11. Frontend: Client-Side Module Structure

All frontend code lives under:

```
src/files/client/custom/modules/{module-name}/
```

### Module path convention

When referencing views in metadata or code, use the path **without** `.js` and **without** `src/files/client/custom/`:

```
modules/{module-name}/views/fields/{field-name}
```

This maps to the file:

```
src/files/client/custom/modules/{module-name}/src/views/fields/{field-name}.js
```

EspoCRM's AMD loader resolves `modules/{module-name}/...` to `client/custom/modules/{module-name}/src/...` when `bundled: true` and `jsTranspiled: true`.

### ES module pattern

All view files use ES module syntax:

```javascript
import SomeBaseView from 'views/fields/base';

export default class extends SomeBaseView {
    // ...
}
```

---

## 12. Frontend: Field Views

### 12.1 Basic field view template

**Path:** `src/files/client/custom/modules/{module-name}/src/views/fields/{field-name}.js`

```javascript
import BaseFieldView from 'views/fields/base';

export default class extends BaseFieldView {

    // Inline templates (no separate .tpl file needed)
    listTemplateContent = '<span>{{value}}</span>';

    detailTemplateContent = `
        <div class="my-field-container" data-name="{{name}}">
            <!-- Detail mode HTML -->
        </div>
    `;

    editTemplateContent = `
        <div class="my-field-container" data-name="{{name}}">
            <!-- Edit mode HTML -->
        </div>
    `;

    // Called when the view is set up
    setup() {
        super.setup();
        // Initialize state, listen to model changes
        this.listenTo(this.model, 'change:' + this.name, () => {
            if (this.isRendered()) {
                this.reRender();
            }
        });
    }

    // Provide data to templates
    data() {
        const data = super.data();
        data.value = this.model.get(this.name);
        return data;
    }

    // Called after the view's DOM element is rendered
    afterRender() {
        super.afterRender();
        if (this.isDetailMode()) {
            this._renderDetailView();
        } else if (this.isEditMode()) {
            this._renderEditView();
        }
    }

    // Extract value from the DOM for saving
    fetch() {
        return {
            [this.name]: this._getCurrentValue(),
        };
    }

    _renderDetailView() {
        // Initialize read-only UI components
    }

    _renderEditView() {
        // Initialize editable UI components
    }

    _getCurrentValue() {
        // Return current field value
        return this.model.get(this.name);
    }
}
```

### 12.2 Available base classes

| Import path | Use case |
|---|---|
| `views/fields/base` | Generic field (most flexible) |
| `views/fields/text` | Text-area-like fields |
| `views/fields/varchar` | Short text fields |
| `views/fields/int` | Integer fields |
| `views/fields/enum` | Dropdown fields |

### 12.3 View modes

The view's `mode` property determines which template is rendered:

| Mode | Property | When |
|---|---|---|
| `list` | `listTemplateContent` | List/table views |
| `detail` | `detailTemplateContent` | Record detail view (read-only) |
| `edit` | `editTemplateContent` | Record edit view |
| `listLink` | `listLinkTemplateContent` | List view with clickable link |
| `search` | `searchTemplateContent` | Advanced search filter |

Check the mode with: `this.isListMode()`, `this.isDetailMode()`, `this.isEditMode()`.

### 12.4 Lifecycle hooks

| Method | When called |
|---|---|
| `setup()` | Once when view is created. Set up listeners, initialize state. |
| `data()` | Before rendering. Return an object of template variables. |
| `afterRender()` | After DOM is created. Initialize UI components (maps, editors, etc.). |
| `fetch()` | When the record is saved. Return `{fieldName: value}` object. |

---

## 13. Frontend: Panel Views

Panels appear as sections on the record detail page (typically at the bottom).

**Path:** `src/files/client/custom/modules/{module-name}/src/views/record/panels/{panel-name}.js`

```javascript
import BottomPanelView from 'views/record/panels/bottom';

export default class extends BottomPanelView {

    templateContent = `
        <div class="my-panel-container">
            <!-- Panel HTML -->
        </div>
    `;

    setup() {
        super.setup();
        // Access panel options from metadata:
        // this.defs.params.someOption
        // Access the parent record model:
        // this.model (the parent entity record)
    }

    afterRender() {
        super.afterRender();
        this._loadData();
    }

    async _loadData() {
        // Fetch related data via Espo.Ajax or the model's collection
        const url = `${this.model.entityType}/${this.model.id}/someLink`;

        try {
            const response = await Espo.Ajax.getRequest(url, {
                select: 'id,name',
                maxSize: 200,
            });
            this._renderContent(response);
        } catch (e) {
            console.error('Failed to load panel data', e);
        }
    }

    _renderContent(data) {
        // Render panel content with loaded data
    }
}
```

### Registering a panel via metadata

Panels can be registered statically in `clientDefs` metadata or dynamically via a Rebuild action. Static registration:

Create `Resources/metadata/clientDefs/{EntityType}.json`:

```json
{
    "bottomPanels": {
        "detail": [
            "__APPEND__",
            {
                "name": "myPanelName",
                "label": "My Panel",
                "view": "modules/{module-name}/views/record/panels/{panel-name}",
                "order": 100,
                "params": {
                    "someOption": "someValue"
                }
            }
        ]
    }
}
```

---

## 14. Frontend: Bundling Third-Party Libraries

If your extension depends on third-party JS libraries (e.g., Leaflet, Chart.js, D3), bundle them as AMD modules.

### 14.1 Install as dev dependencies

```bash
npm install --save-dev your-library
```

### 14.2 Create `rollup.config.mjs`

```javascript
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default [
    {
        input: 'node_modules/your-library/dist/your-library.esm.js',
        output: {
            file: 'build/assets/lib/your-library.js',
            format: 'amd',
            amd: { id: 'your-library' },
        },
        plugins: [resolve(), commonjs()],
    },
];
```

### 14.3 Add Rollup dev dependencies

```bash
npm install --save-dev rollup @rollup/plugin-node-resolve @rollup/plugin-commonjs
```

### 14.4 Wire into the build

In `extension.json`:

```json
{
  "scripts": ["npx rollup -c rollup.config.mjs"]
}
```

The `scripts` array runs before the extension zip is assembled. Rollup output goes to `build/assets/lib/`, which gets copied into the extension. Copy the output to `src/files/client/custom/modules/{module-name}/lib/` for development.

### 14.5 Register in metadata

In `Resources/metadata/app/jsLibs.json`:

```json
{
    "your-library": {
        "path": "client/custom/modules/{module-name}/lib/your-library.js",
        "exportsTo": "window",
        "exportsAs": "YourLibrary"
    }
}
```

---

## 15. Frontend: CSS and Assets

### 15.1 Place CSS files

Put stylesheets in `src/files/client/custom/modules/{module-name}/css/`.

### 15.2 Register in metadata

In `Resources/metadata/app/client.json`:

```json
{
    "cssList": [
        "__APPEND__",
        "client/custom/modules/{module-name}/css/your-styles.css"
    ]
}
```

### 15.3 Image assets

Place images in `src/files/client/custom/modules/{module-name}/css/images/` and reference them from CSS with relative paths.

---

## 16. npm Scripts

Here is every script and what it does:

| Script | Command | Purpose |
|---|---|---|
| `copy` | `node build --copy` | Copy `src/files/` into the `site/` EspoCRM instance |
| `sync` | `node build --copy && node build --composer-install` | Copy + install PHP deps |
| `extension` | `node build --extension` | Build the installable `.zip` in `build/` |
| `all` | `node build --all` | Full build: clone EspoCRM, install, copy extension, rebuild |
| `rebuild` | `node build --rebuild` | Trigger EspoCRM metadata rebuild |
| `clear-cache` | `php site/clear_cache.php` | Clear EspoCRM cache |
| `prepare-test` | `node build --prepare-test` | Clone EspoCRM sources for testing |
| `bundle-libs` | `npx rollup -c rollup.config.mjs` | Bundle third-party JS via Rollup |
| `e2e:install-browsers` | `playwright install chromium` | Download Chromium for Playwright |
| `e2e:docker:up` | `docker compose up -d --build db app` | Start Docker E2E environment |
| `e2e:docker:down` | `docker compose down -v` | Stop Docker, remove volumes |
| `e2e:prepare-installed` | Docker-based extension install | Build zip, install in Docker EspoCRM |
| `e2e:prepare-installed:local` | Local extension install | Build zip, install in local EspoCRM |
| `e2e:test` | `playwright test` | Run Playwright E2E tests |
| `e2e:test:headed` | `playwright test --headed` | Run E2E tests with visible browser |
| `e2e:packaged` | prepare + test (Docker) | Full Docker E2E pipeline |
| `e2e:packaged:local` | prepare + test (local) | Full local E2E pipeline |

---

## 17. Docker E2E Environment

### 17.1 `docker-compose.yml`

```yaml
services:
  db:
    image: mysql:8.0
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${E2E_DB_ROOT_PASSWORD:-root}
      MYSQL_DATABASE: ${E2E_DB_NAME:-ext-your-module}
      MYSQL_USER: ${E2E_DB_USER:-espocrm}
      MYSQL_PASSWORD: ${E2E_DB_PASSWORD:-espocrm}
    ports:
      - "${E2E_DB_PORT:-3307}:3306"
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "-p${E2E_DB_ROOT_PASSWORD:-root}"]
      interval: 5s
      timeout: 5s
      retries: 30
    volumes:
      - e2e_mysql_data:/var/lib/mysql

  app:
    platform: linux/amd64
    build:
      context: .
      dockerfile: docker/e2e/app.Dockerfile
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    working_dir: /workspace
    environment:
      PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: "1"
      PUPPETEER_SKIP_DOWNLOAD: "1"
      E2E_DB_HOST: db
      E2E_DB_NAME: ${E2E_DB_NAME:-ext-your-module}
      E2E_DB_USER: ${E2E_DB_USER:-espocrm}
      E2E_DB_PASSWORD: ${E2E_DB_PASSWORD:-espocrm}
      E2E_SITE_URL: ${E2E_SITE_URL:-http://localhost:8080}
      E2E_ADMIN_USERNAME: ${E2E_ADMIN_USERNAME:-admin}
      E2E_ADMIN_PASSWORD: ${E2E_ADMIN_PASSWORD:-1}
    ports:
      - "${E2E_APP_PORT:-8080}:80"
    volumes:
      - ./:/workspace
      - e2e_node_modules:/workspace/node_modules

volumes:
  e2e_mysql_data:
  e2e_node_modules:
```

**Architecture:** The `app` container runs PHP+Apache serving the EspoCRM `site/` directory. The entire project root is mounted at `/workspace`. The `db` container runs MySQL. Playwright runs on the **host machine** and connects to `http://localhost:8080`.

### 17.2 `docker/e2e/app.Dockerfile`

```dockerfile
FROM php:8.3-apache

# System dependencies + PHP extensions required by EspoCRM
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    default-mysql-client \
    git \
    gnupg \
    libfreetype6-dev \
    libjpeg62-turbo-dev \
    libpng-dev \
    libzip-dev \
    pkg-config \
    unzip \
    zip \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install exif gd mysqli pdo_mysql zip \
    && rm -rf /var/lib/apt/lists/*

# Node.js for build tooling
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get update \
    && apt-get install -y nodejs \
    && npm install -g grunt-cli \
    && rm -rf /var/lib/apt/lists/*

# Composer for PHP dependencies
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

# Apache config: enable mod_rewrite, point document root to /workspace/site
RUN a2enmod rewrite

RUN sed -ri 's!/var/www/html!/workspace/site!g' /etc/apache2/sites-available/000-default.conf \
    && printf '<Directory /workspace/site>\nAllowOverride All\nRequire all granted\n</Directory>\n' \
       > /etc/apache2/conf-available/workspace-site.conf \
    && a2enconf workspace-site

WORKDIR /workspace
```

---

## 18. E2E Preparation Scripts

### 18.1 Local prep — `scripts/e2e/prepare-installed-extension.mjs`

This script:
1. Fetches fresh EspoCRM sources (`node build --prepare-test`)
2. Installs a clean EspoCRM instance (`node build --install`)
3. Builds the extension zip (`node build --extension`)
4. Installs the zip into EspoCRM via PHP CLI
5. Runs rebuild

```javascript
import fs from 'node:fs';
import path from 'node:path';
import {execSync} from 'node:child_process';

const projectRoot = process.cwd();
const siteDir = path.join(projectRoot, 'site');
const buildDir = path.join(projectRoot, 'build');

function run(command, cwd = projectRoot) {
    console.log(`\n> ${command}`);
    execSync(command, { cwd, stdio: 'inherit' });
}

function getNewestZipFile() {
    if (!fs.existsSync(buildDir)) {
        throw new Error('Build directory not found. Expected `build/`.');
    }

    const candidates = fs
        .readdirSync(buildDir)
        .filter(file => file.toLowerCase().endsWith('.zip'))
        .map(file => {
            const fullPath = path.join(buildDir, file);
            const stat = fs.statSync(fullPath);
            return { file, mtimeMs: stat.mtimeMs };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs);

    if (!candidates.length) {
        throw new Error('No extension zip found in `build/`.');
    }

    return candidates[0].file;
}

function main() {
    console.log('Preparing a clean EspoCRM instance for packaged-install E2E tests...');

    run('node build --prepare-test');
    run('node build --install');
    run('node build --extension');

    const zipFile = getNewestZipFile();

    console.log(`\nInstalling packaged extension artifact: ${zipFile}`);
    run(`php command.php extension --file="../build/${zipFile}"`, siteDir);
    run('php command.php rebuild', siteDir);

    console.log('\nPackaged-install E2E environment is ready.');
}

main();
```

### 18.2 Docker prep — `scripts/e2e/prepare-installed-extension-docker.mjs`

This script:
1. Writes a Docker-specific `config.json` using env vars
2. Starts Docker Compose services
3. Runs `npm ci` inside the container
4. Executes the local prep script inside the container

```javascript
import fs from 'node:fs';
import path from 'node:path';
import {execSync} from 'node:child_process';

const projectRoot = process.cwd();
const configPath = path.join(projectRoot, 'config.json');

function run(command) {
    console.log(`\n> ${command}`);
    execSync(command, { cwd: projectRoot, stdio: 'inherit' });
}

function writeDockerConfig() {
    const config = {
        espocrm: {
            repository: 'https://github.com/espocrm/espocrm.git',
            branch: 'stable',
        },
        database: {
            host: process.env.E2E_DB_HOST || 'db',
            port: null,
            charset: 'utf8mb4',
            dbname: process.env.E2E_DB_NAME || 'ext-your-module',
            user: process.env.E2E_DB_USER || 'espocrm',
            password: process.env.E2E_DB_PASSWORD || 'espocrm',
        },
        install: {
            language: 'en_US',
            defaultOwner: 'www-data',
            defaultGroup: 'www-data',
            siteUrl: process.env.E2E_SITE_URL || 'http://localhost:8080',
            adminUsername: process.env.E2E_ADMIN_USERNAME || 'admin',
            adminPassword: process.env.E2E_ADMIN_PASSWORD || '1',
        },
    };

    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

function main() {
    console.log('Preparing Dockerized packaged-install E2E environment...');

    writeDockerConfig();

    run('docker compose up -d --build db app');
    run('docker compose exec -T app sh -lc "npm ci"');
    run('docker compose exec -T app sh -lc "node scripts/e2e/prepare-installed-extension.mjs"');

    console.log('\nDockerized packaged-install E2E environment is ready.');
}

main();
```

---

## 19. Playwright Configuration

**File:** `playwright.config.mjs`

```javascript
import {defineConfig} from '@playwright/test';

const baseURL = process.env.ESPO_E2E_BASE_URL || 'http://127.0.0.1:8080';

export default defineConfig({
    testDir: './e2e/tests',
    timeout: 60_000,
    expect: {
        timeout: 10_000,
    },
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [['list'], ['html', {open: 'never'}]] : 'list',
    use: {
        baseURL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: {
                browserName: 'chromium',
                headless: true,
            },
        },
    ],
});
```

**Key settings:**
- `fullyParallel: false` — EspoCRM tests modify shared state (entities, fields, layouts), so run sequentially.
- `timeout: 60_000` — EspoCRM pages can be slow on first load.
- `trace/screenshot/video: 'retain-on-failure'` — Captures debugging artifacts only when tests fail.

---

## 20. Writing E2E Tests

### 20.1 Smoke test — verify extension is installed

**File:** `e2e/tests/installed-extension.smoke.spec.js`

```javascript
import {test, expect} from '@playwright/test';

const adminUsername = process.env.ESPO_E2E_ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ESPO_E2E_ADMIN_PASSWORD || '1';

async function login(page) {
    await page.goto('/#Login');

    const usernameInput = page.locator('input[name="username"]');
    if (!(await usernameInput.isVisible())) return;

    await usernameInput.fill(adminUsername);
    await page.locator('input[name="password"]').fill(adminPassword);

    const submitButton = page
        .locator('button[type="submit"], .btn.btn-primary')
        .first();

    await submitButton.click();
    await expect(page).not.toHaveURL(/#Login/);
}

test('extension appears in admin extensions page', async ({page}) => {
    await login(page);
    await page.goto('/#Admin/extensions');
    await expect(page.getByText('{ModuleName}')).toBeVisible();
});
```

### 20.2 Feature test template

**File:** `e2e/tests/{your-feature}.spec.js`

```javascript
import {test, expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const adminUsername = process.env.ESPO_E2E_ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ESPO_E2E_ADMIN_PASSWORD || '1';
const baseURL = process.env.ESPO_E2E_BASE_URL || 'http://127.0.0.1:8080';
const projectRoot = process.cwd();

// ─── API helper ──────────────────────────────────────────────

async function apiRequest(method, apiPath, body) {
    const credentials = btoa(`${adminUsername}:${adminPassword}`);
    const url = `${baseURL}/api/v1/${apiPath}`;

    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${credentials}`,
        },
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
        const text = await response.text();
        throw new Error(
            `API ${method} ${apiPath} failed (${response.status}): ${text}`
        );
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength === '0') return {};

    return response.json();
}

// ─── Page helpers ────────────────────────────────────────────

async function login(page) {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const usernameInput = page.locator('#field-userName');

    try {
        await usernameInput.waitFor({state: 'visible', timeout: 10_000});
    } catch {
        return; // Already logged in
    }

    await usernameInput.fill(adminUsername);
    await page.locator('#field-password').fill(adminPassword);
    await page.locator('#btn-login').click();

    await page.waitForSelector('#field-userName', {
        state: 'hidden',
        timeout: 15_000,
    });

    await page.waitForLoadState('networkidle');
}

async function navigateTo(page, hash) {
    await page.goto(`${baseURL}/#${hash}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);
}

// ─── Layout helper ───────────────────────────────────────────

function writeLayout(scope, name, layout) {
    const layoutDir = path.join(
        projectRoot, 'site', 'custom', 'Espo', 'Custom',
        'Resources', 'layouts', scope
    );
    fs.mkdirSync(layoutDir, {recursive: true});
    const layoutPath = path.join(layoutDir, `${name}.json`);
    fs.writeFileSync(layoutPath, JSON.stringify(layout, null, 4), 'utf8');
}

// ─── Rebuild helper ──────────────────────────────────────────

async function rebuild() {
    try {
        await apiRequest('POST', 'Admin/rebuild', {});
    } catch {
        try {
            await apiRequest('POST', 'Admin/clearCache', {});
        } catch {
            // Cache will clear on next request
        }
    }
}

// ─── Setup & Teardown ────────────────────────────────────────

let testRecordIds = [];

test.describe('Your Feature Tests', () => {

    test.beforeAll(async () => {
        // 1. Create entities/fields via API
        try {
            await apiRequest('POST', 'EntityManager/action/createEntity', {
                name: 'TestEntity',
                type: 'Base',
                labelSingular: 'Test Entity',
                labelPlural: 'Test Entities',
            });
        } catch { /* already exists */ }

        // 2. Create fields via API
        try {
            await apiRequest('POST', 'Admin/fieldManager/CTestEntity', {
                name: 'myField',
                type: 'yourFieldType',
                // ... field params
            });
        } catch {
            await apiRequest(
                'PUT', 'Admin/fieldManager/CTestEntity/myField',
                { type: 'yourFieldType' }
            ).catch(() => {});
        }

        // 3. Write layouts
        writeLayout('CTestEntity', 'detail', [
            {
                label: 'Overview',
                rows: [
                    [{name: 'name'}, false],
                    [{name: 'myField', fullWidth: true}],
                ],
            },
        ]);

        // 4. Rebuild to apply metadata changes
        await rebuild();

        // 5. Create test data via API
        const record = await apiRequest('POST', 'CTestEntity', {
            name: 'E2E Test Record',
            myField: 'some value',
        });
        testRecordIds.push(record.id);
    });

    test.afterAll(async () => {
        for (const id of testRecordIds) {
            await apiRequest('DELETE', `CTestEntity/${id}`).catch(() => {});
        }
    });

    test('field renders on detail view', async ({page}) => {
        await login(page);
        await navigateTo(page, `CTestEntity/view/${testRecordIds[0]}`);

        const fieldContainer = page.locator('.my-field-container');
        await expect(fieldContainer.first()).toBeVisible({timeout: 15_000});
    });

    test('data loads via API', async ({page}) => {
        await login(page);

        const apiPromise = page.waitForResponse(
            (response) =>
                response.url().includes(`/CTestEntity/${testRecordIds[0]}`) &&
                response.status() === 200
        );

        await navigateTo(page, `CTestEntity/view/${testRecordIds[0]}`);

        const response = await apiPromise;
        const data = await response.json();

        expect(data.myField).toBeDefined();
    });
});
```

### 20.3 EspoCRM E2E test patterns

**Entity creation via API:**
- `POST EntityManager/action/createEntity` — creates a new entity type. EspoCRM prefixes with `C`, so entity name `TestEntity` becomes `CTestEntity`.
- `POST Admin/fieldManager/{EntityType}` — creates a new field on an entity.
- `PUT Admin/fieldManager/{EntityType}/{fieldName}` — updates an existing field.
- `POST EntityManager/action/createLink` — creates a relationship between two entities.

**Layout management:**
- Layouts are JSON files written directly to `site/custom/Espo/Custom/Resources/layouts/{EntityType}/{layoutName}.json`.
- Detail layout format: array of panel objects, each with `label` and `rows`. Each row is an array of two cells (or one cell + `false` for half-width, or one `{fullWidth: true}` cell).
- List layout format: array of column objects with `name`, `width`, and optional `link: true`.

**Login pattern:**
- Navigate to `/` or `/#Login`.
- Fill `#field-userName` and `#field-password`, click `#btn-login`.
- Wait for `#field-userName` to become hidden (successful login).
- Always call `waitForLoadState('networkidle')` after navigation.

**Navigation pattern:**
- Use hash-based navigation: `page.goto(baseURL + '/#EntityType/view/' + recordId)`.
- Always follow with `waitForLoadState('networkidle')` and a short `waitForTimeout(1500)` to allow EspoCRM's SPA router to settle.

**Rebuild after metadata changes:**
- After creating entities, fields, relationships, or writing layouts, call `POST Admin/rebuild` via the API before running UI assertions.

---

## 21. Running the Full Pipeline

### First-time setup

```bash
git clone <your-repo>
cd <project-directory>
npm install
npm run e2e:install-browsers
```

### Docker-based E2E (recommended)

```bash
# Full pipeline: build, install, test
npm run e2e:packaged

# Or step-by-step:
npm run e2e:docker:up                # Start Docker services
npm run e2e:prepare-installed        # Build and install extension in Docker
npm run e2e:test                     # Run Playwright tests from host
npm run e2e:test:headed              # (Optional) Run with visible browser
npm run e2e:docker:down              # Cleanup
```

### Against existing dev instance

```bash
# If you already have EspoCRM running at localhost:8080
npm run copy
docker compose exec app php site/rebuild.php

ESPO_E2E_BASE_URL=http://localhost:8080 npx playwright test
```

### CI integration

Set `CI=true` as an environment variable. This enables:
- `forbidOnly: true` — fails if any `test.only()` is left in
- `retries: 2` — retries failed tests twice
- HTML reporter in addition to list reporter

---

## 22. Naming Conventions Reference

| Thing | Convention | Example |
|---|---|---|
| Module name (PHP) | PascalCase | `GeoSpatial` |
| Module directory (client) | kebab-case | `geo-spatial` |
| PHP namespace | `Espo\Modules\{ModuleName}` | `Espo\Modules\GeoSpatial` |
| PHP class names | PascalCase | `GeometryType`, `GeoAggregatePanelConfig` |
| Field type names | camelCase | `geometry`, `geometryAggregate` |
| Field metadata files | `{fieldType}.json` | `geometry.json`, `geometryAggregate.json` |
| Client view paths | `modules/{module-name}/views/...` | `modules/geo-spatial/views/fields/geometry` |
| Client JS files | kebab-case | `geometry-aggregate.js`, `map-utils.js` |
| CSS files | kebab-case | `geo-spatial.css` |
| Entity names (user-created) | PascalCase | `Parcel` (becomes `CParcel` in API) |
| Entity names (custom, API) | Prefixed with `C` | `CParcel`, `CTestEntity` |
| Relationship links | camelCase | `cCParcels`, `account` |
| Translation scopes | PascalCase matching module | `GeoSpatial` |
| npm package name | kebab-case with `espocrm-ext-` prefix | `espocrm-ext-geo-spatial` |
| Docker compose services | lowercase | `db`, `app` |

---

## 23. Common Pitfalls

### Build & packaging

1. **Missing `"__APPEND__"`** — If you omit this in `client.json`, `rebuild.json`, or `clientDefs`, your values will *replace* the entire list instead of appending.

2. **Wrong module path in `view`** — The view path in field metadata must be `modules/{module-name}/views/...` (no `.js`, no `src/files/client/custom/` prefix).

3. **`bundled` mismatch** — If `extension.json` has `"bundled": true`, then `module.json` must also have `"bundled": true` and `"jsTranspiled": true`.

4. **Forgetting `AfterInstall.php`** — Without the rebuild call in AfterInstall, metadata changes won't take effect until the admin manually rebuilds.

5. **Rollup output location** — Rollup builds to `build/assets/lib/`. For development, you also need copies in `src/files/client/custom/modules/{module-name}/lib/`.

### E2E testing

6. **Entity name prefix** — When you create an entity named `Parcel` via EntityManager API, EspoCRM internally names it `CParcel`. All API paths, layout directories, and field manager paths use the `C`-prefixed name.

7. **Rebuild timing** — Always call `Admin/rebuild` API after creating entities, fields, or relationships, and before running UI assertions.

8. **`networkidle` is not enough** — EspoCRM's SPA router may still be rendering after `networkidle`. Add `waitForTimeout(1500)` after navigation.

9. **Login selector** — The login form has two different structures depending on EspoCRM version. The recommended selectors are `#field-userName`, `#field-password`, `#btn-login`.

10. **Sequential tests** — Set `fullyParallel: false` in Playwright config. EspoCRM E2E tests share state (database, entities) and cannot run in parallel.

11. **Layout file path** — Layouts must be written to `site/custom/Espo/Custom/Resources/layouts/{EntityType}/{layoutName}.json` (note the `Custom` directory, not `Modules`).

12. **Docker volume for node_modules** — Use a named volume for `node_modules` inside the container to avoid conflicts with host node_modules (especially for native binaries).

13. **`-T` flag for Docker exec** — Always use `docker compose exec -T` in scripts (non-interactive mode). Without it, the command hangs in CI.

---

## Quick-Start Checklist

For an LLM agent building a new EspoCRM extension, execute in this order:

- [ ] Create project scaffold (Section 2)
- [ ] Write `extension.json` (Section 3)
- [ ] Write `build.js` (Section 4)
- [ ] Write `config-default.json` (Section 5)
- [ ] Create PHP module structure with `module.json` (Section 6)
- [ ] Define field type metadata (Section 7.1)
- [ ] Register client resources in `app/client.json` and `app/jsLibs.json` (Sections 7.2, 7.3)
- [ ] Write PHP validator/rebuild classes if needed (Section 8)
- [ ] Add translations (Section 9)
- [ ] Write `AfterInstall.php` (Section 10)
- [ ] Create frontend field views (Section 12)
- [ ] Create frontend panel views if needed (Section 13)
- [ ] Bundle third-party libraries if needed (Section 14)
- [ ] Add CSS (Section 15)
- [ ] Write Docker setup (Section 17)
- [ ] Write E2E preparation scripts (Section 18)
- [ ] Write Playwright config (Section 19)
- [ ] Write smoke test (Section 20.1)
- [ ] Write feature tests (Section 20.2)
- [ ] Run `npm install && npm run e2e:packaged` to verify everything works (Section 21)
