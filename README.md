# EspoCRM GeoSpatial Extension

A geospatial extension for EspoCRM that adds a **Geometry** field type with interactive Leaflet map editing and automatic aggregation map panels on parent entities.

## Features

- **Custom `Geometry` field type** -- addable to any entity through Entity Manager, just like a text or number field
- **Interactive map editor** -- draw and edit Points, Lines, and Polygons on an OpenStreetMap-powered Leaflet map
- **GeoJSON storage** -- geometries are stored as standard GeoJSON in a MySQL TEXT column, keeping full compatibility with EspoCRM's ORM
- **Auto-aggregation map panels** -- when a parent entity has a one-to-many relationship to children with geometry fields, a combined map panel appears automatically on the parent's detail view
- **Server-side GeoJSON validation** -- all geometry data is validated against the GeoJSON specification before saving

## Requirements

| Dependency | Version |
|---|---|
| EspoCRM | >= 8.0.0 |
| PHP | >= 8.1 |
| MySQL / MariaDB | 5.7+ / 10.2+ |
| Node.js | >= 18 |
| npm | >= 8 |
| Composer | latest (for EspoCRM dev instance) |

---

## Installation (Production)

Use this method to install the extension on an existing EspoCRM instance.

### 1. Build the extension package

On your development machine (requires Node.js >= 18):

```bash
git clone <this-repository>
cd "ESPO CRM Spatial Extenstion"

npm install
npm run extension
```

This creates a `.zip` file in the `build/` directory, for example `build/GeoSpatial-0.1.0.zip`.

### 2. Upload to EspoCRM

1. Log in to your EspoCRM as an administrator
2. Go to **Administration** (top-right menu)
3. Click **Extensions** (under the System section)
4. Click **Choose File**, select the `.zip` file from step 1
5. Click **Upload**
6. Review the extension details, then click **Install**

The extension runs an `AfterInstall` script that triggers a full Rebuild automatically.

### 3. Verify

After installation:
- Go to **Administration > Entity Manager**, pick any entity, click **Fields**, then **Create Field** -- you should see **Geometry** in the field type list
- Go to **Administration > Rebuild** if you don't see it immediately

---

## Installation (Development)

Use this method to develop the extension with a local EspoCRM instance.

### 1. Clone and configure

```bash
git clone <this-repository>
cd "ESPO CRM Spatial Extenstion"

# Create your local config
cp config-default.json config.json
```

Edit `config.json` with your local settings:

```json
{
  "database": {
    "host": "localhost",
    "port": null,
    "charset": "utf8mb4",
    "dbname": "ext-geo-spatial",
    "user": "your_db_user",
    "password": "your_db_password"
  },
  "install": {
    "siteUrl": "http://localhost/ext-geo-spatial/site",
    "defaultOwner": "www-data",
    "defaultGroup": "www-data"
  }
}
```

**Important:** The `defaultOwner` and `defaultGroup` must match your web server user. Common values:

| Platform | Owner | Group |
|---|---|---|
| Ubuntu/Debian (Apache) | `www-data` | `www-data` |
| CentOS/RHEL (Apache) | `apache` | `apache` |
| macOS (local dev) | your username | `staff` |
| Docker | `www-data` | `www-data` |

### 2. Create the database

```bash
mysql -u root -p -e "CREATE DATABASE \`ext-geo-spatial\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 3. Build the full EspoCRM instance

```bash
npm install
npm run all
```

This will:
1. Clone the EspoCRM stable branch into `site/`
2. Install EspoCRM with the configured database
3. Bundle Leaflet and Leaflet.draw via Rollup
4. Copy extension files into the EspoCRM instance
5. Install the extension and run the AfterInstall script

Once complete, the dev instance is available at the `siteUrl` you configured.

- **Username:** `admin`
- **Password:** `1`

### 4. Development workflow

After making changes to files in `src/`:

```bash
# Copy changed files to the EspoCRM instance
npm run sync

# Then clear cache in EspoCRM: Administration > Clear Cache
# Or via CLI:
npm run clear-cache
```

Alternatively, set up a file watcher in your IDE to run `node build --copy-file --file=$FilePathRelativeToProjectRoot$` on save.

### Available npm scripts

| Script | Description |
|---|---|
| `npm run all` | Full build: clone EspoCRM, install, copy extension |
| `npm run sync` | Copy extension files + install composer deps |
| `npm run copy` | Copy extension files only (no composer) |
| `npm run extension` | Build the installable `.zip` package |
| `npm run rebuild` | Trigger EspoCRM rebuild |
| `npm run clear-cache` | Clear EspoCRM cache |
| `npm run bundle-libs` | Re-bundle Leaflet via Rollup |
| `npm run unit-tests` | Run PHPUnit unit tests |
| `npm run integration-tests` | Run PHPUnit integration tests |
| `npm run e2e:docker:up` | Start Docker E2E app + db services |
| `npm run e2e:docker:down` | Stop Docker E2E services and remove volumes |
| `npm run e2e:prepare-installed` | Dockerized packaged install prep for E2E |
| `npm run e2e:test` | Run Playwright E2E tests |
| `npm run e2e:packaged` | Dockerized packaged install and E2E test run |
| `npm run e2e:packaged:local` | Local packaged install and E2E run (no Docker) |
| `npm run sa` | Run PHPStan static analysis |

---

## Usage Guide

### Adding a Geometry Field to an Entity

1. Go to **Administration > Entity Manager**
2. Select the entity you want to add the field to (e.g., `Account`, `Contact`, or a custom entity)
3. Click **Fields** in the left sidebar
4. Click **Create Field** at the top
5. Select **Geometry** from the field type list
6. Configure the field:

| Parameter | Description | Default |
|---|---|---|
| **Geometry Types** | Which geometry types can be drawn -- Point, LineString, Polygon (multi-select) | All three |
| **Default Latitude** | Map center latitude when no geometry exists yet | 51.505 |
| **Default Longitude** | Map center longitude when no geometry exists yet | -0.09 |
| **Default Zoom** | Initial map zoom level (1 = world, 20 = building) | 13 |
| **Map Height** | Height of the map container in pixels | 400 |
| **Required** | Whether the field must be filled before saving | false |
| **Read Only** | Whether the geometry can be edited | false |
| **Audited** | Track changes to this field in the audit log | false |

7. Click **Save**
8. Go to **Administration > Rebuild**
9. Add the field to the entity's **Detail** and **Edit** layouts via **Administration > Entity Manager > [Entity] > Layouts**

### Editing Geometry on the Map

- **Drawing:** In edit mode, use the toolbar on the right side of the map to draw shapes. Click the marker icon for a Point, the polyline icon for a Line, or the polygon icon for a Polygon.
- **Editing:** Click the edit icon (pencil) in the toolbar, then drag vertices to reshape existing geometries.
- **Deleting:** Click the trash icon in the toolbar, then click the geometry you want to remove. Confirm with "Save" in the toolbar.
- **Saving:** The geometry is saved when you click the record's **Save** button. The map state is serialized as GeoJSON and stored in the database.

### Viewing Geometry

- **Detail view:** A read-only map displays the stored geometry, auto-zoomed to fit the shape.
- **List view:** A compact badge shows the geometry type (e.g., "Polygon", "Point") rather than a map, for performance.

### Automatic Aggregation Map Panel

When a parent entity has a **one-to-many** (or **has-many**) relationship to child entities that contain geometry fields, the extension automatically creates a map panel on the parent's detail view.

**How it works:**

1. You create Entity A (e.g., `Project`) and Entity B (e.g., `Site`) with a geometry field
2. You create a one-to-many relationship: Project has many Sites
3. You run **Administration > Rebuild**
4. Open any Project record -- a **Map** panel appears at the bottom, showing all related Sites' geometries on a single map
5. Click any feature on the map to see a popup with the child record's name and a link to navigate to it

**When does auto-detection run?**

- On extension install (via the AfterInstall script)
- On every **Administration > Rebuild**
- It scans all entity definitions for `geometry`-type fields, traces their `hasMany`/`hasChildren` relationship links back to parent entities, and registers the map panel on each parent's `clientDefs`

---

## Data Format

Geometry values are stored as [GeoJSON](https://geojson.org/) text. The extension supports the following GeoJSON types:

**Single features:**
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [-0.09, 51.505]
  },
  "properties": {}
}
```

**Multiple features** (when several shapes are drawn on one field):
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-0.09, 51.505], [-0.08, 51.51], [-0.07, 51.505], [-0.09, 51.505]]]
      },
      "properties": {}
    }
  ]
}
```

Supported geometry types: `Point`, `LineString`, `Polygon`, `MultiPoint`, `MultiLineString`, `MultiPolygon`, `GeometryCollection`.

Note: GeoJSON coordinates are `[longitude, latitude]` (not `[lat, lng]`).

---

## Project Structure

```
.
├── build.js                          # espo-extension-tools entry point
├── config-default.json               # default dev config (copy to config.json)
├── extension.json                    # extension manifest
├── package.json                      # npm project config
├── rollup.config.mjs                 # Rollup config for Leaflet bundling
│
└── src/
    ├── files/
    │   ├── custom/Espo/Modules/GeoSpatial/
    │   │   ├── Resources/
    │   │   │   ├── module.json                    # module order + bundled flag
    │   │   │   ├── metadata/
    │   │   │   │   ├── fields/geometry.json       # field type definition
    │   │   │   │   └── app/
    │   │   │   │       ├── client.json            # CSS registration
    │   │   │   │       ├── jsLibs.json            # Leaflet AMD module registration
    │   │   │   │       └── rebuild.json           # rebuild action registration
    │   │   │   └── i18n/en_US/
    │   │   │       ├── Admin.json                 # field type label
    │   │   │       └── GeoSpatial.json            # panel/tooltip translations
    │   │   └── Classes/
    │   │       ├── FieldValidators/
    │   │       │   └── GeometryType.php           # GeoJSON server-side validation
    │   │       └── Rebuild/
    │   │           └── GeoAggregatePanelConfig.php # auto-detect aggregation panels
    │   │
    │   └── client/custom/modules/geo-spatial/
    │       ├── src/
    │       │   ├── views/fields/geometry.js                  # field view (detail/edit/list)
    │       │   ├── views/record/panels/geo-aggregate-map.js  # aggregation panel
    │       │   └── lib/map-utils.js                          # shared Leaflet utilities
    │       ├── lib/
    │       │   ├── leaflet.js                     # Leaflet bundled as AMD
    │       │   └── leaflet-draw.js                # Leaflet.draw bundled as AMD
    │       └── css/
    │           ├── leaflet.css                    # Leaflet styles
    │           ├── leaflet-draw.css               # Leaflet.draw styles
    │           ├── geo-spatial.css                # custom map container styles
    │           └── images/                        # map marker & control images
    │
    └── scripts/
        └── AfterInstall.php                       # triggers rebuild on install
```

---

## Troubleshooting

**"Geometry" field type does not appear in Entity Manager**

Run **Administration > Rebuild**. The field type is registered via metadata and requires a cache rebuild to become visible.

**Map does not render / blank container**

- Open the browser developer console and check for JavaScript errors
- Verify that the Leaflet CSS files are being loaded (check Network tab for `leaflet.css`)
- Make sure you added the geometry field to the entity's Detail layout via **Entity Manager > Layouts**

**Aggregation map panel does not appear on parent entity**

- The child entity must have at least one field of type `geometry`
- The relationship must be `hasMany` or `hasChildren` (one-to-many from parent to child)
- Run **Administration > Rebuild** after creating the relationship
- Check `custom/Espo/Custom/Resources/metadata/clientDefs/{ParentEntity}.json` -- the panel should be registered there after rebuild

**"Invalid geometry" validation error on save**

The stored value must be valid GeoJSON. If you are setting the field via API, ensure your JSON conforms to the [GeoJSON spec (RFC 7946)](https://datatracker.ietf.org/doc/html/rfc7946). Common issues:
- Coordinates must be `[longitude, latitude]`, not `[latitude, longitude]`
- Polygon rings must have at least 4 coordinate pairs and the first and last must be identical
- LineStrings must have at least 2 coordinate pairs

**Map tiles not loading (gray/empty map)**

The extension uses OpenStreetMap tiles by default. Ensure your server/browser has outbound internet access to `https://{s}.tile.openstreetmap.org/`.

---

## API Usage

Geometry fields are accessible through EspoCRM's standard REST API like any other field.

**Read a record with a geometry field:**

```
GET /api/v1/MyEntity/RECORD_ID
```

Response includes the geometry field as a JSON string:
```json
{
  "id": "abc123",
  "name": "My Record",
  "location": "{\"type\":\"Feature\",\"geometry\":{\"type\":\"Point\",\"coordinates\":[-0.09,51.505]},\"properties\":{}}"
}
```

**Update a geometry field:**

```
PUT /api/v1/MyEntity/RECORD_ID
Content-Type: application/json

{
  "location": "{\"type\":\"Feature\",\"geometry\":{\"type\":\"Polygon\",\"coordinates\":[[[-0.09,51.505],[-0.08,51.51],[-0.07,51.505],[-0.09,51.505]]]},\"properties\":{}}"
}
```

**Fetch related records for aggregation (what the map panel does internally):**

```
GET /api/v1/ParentEntity/PARENT_ID/childLink?select=id,name,geometryFieldName&maxSize=200
```

---

## Versioning

The version is managed in `package.json`. Bump it with:

```bash
npm version patch   # 0.1.0 -> 0.1.1
npm version minor   # 0.1.0 -> 0.2.0
npm version major   # 0.1.0 -> 1.0.0
```

Then rebuild the extension package: `npm run extension`.

---

## License

MIT
