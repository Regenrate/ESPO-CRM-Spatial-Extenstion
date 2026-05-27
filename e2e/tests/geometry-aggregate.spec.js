import {test, expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const adminUsername = process.env.ESPO_E2E_ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ESPO_E2E_ADMIN_PASSWORD || '1';
const baseURL = process.env.ESPO_E2E_BASE_URL || 'http://127.0.0.1:8080';
const keepRecords = process.env.ESPO_E2E_KEEP_RECORDS === '1' ||
    process.env.ESPO_E2E_KEEP_RECORDS === 'true';
const projectRoot = process.cwd();

const POLYGON_GEOJSON = JSON.stringify({
    type: 'Feature',
    geometry: {
        type: 'Polygon',
        coordinates: [[
            [-0.095, 51.508], [-0.085, 51.508],
            [-0.085, 51.512], [-0.095, 51.512],
            [-0.095, 51.508],
        ]],
    },
    properties: {},
});

const POINT_GEOJSON = JSON.stringify({
    type: 'Feature',
    geometry: {
        type: 'Point',
        coordinates: [-0.088, 51.510],
    },
    properties: {},
});

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

    if (contentLength === '0') {
        return {};
    }

    return response.json();
}

async function login(page) {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const usernameInput = page.locator('#field-userName');

    try {
        await usernameInput.waitFor({state: 'visible', timeout: 10_000});
    } catch {
        return;
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

function writeLayout(scope, name, layout) {
    const layoutDir = path.join(
        projectRoot, 'site', 'custom', 'Espo', 'Custom',
        'Resources', 'layouts', scope
    );

    fs.mkdirSync(layoutDir, {recursive: true});

    const layoutPath = path.join(layoutDir, `${name}.json`);

    fs.writeFileSync(layoutPath, JSON.stringify(layout, null, 4), 'utf8');
}

async function setupEntityAndFields() {
    try {
        await apiRequest('POST', 'EntityManager/action/createEntity', {
            name: 'Parcel',
            type: 'Base',
            labelSingular: 'Parcel',
            labelPlural: 'Parcels',
            textFilterFields: ['name'],
        });
    } catch {
        // already exists
    }

    try {
        await apiRequest('POST', 'Admin/fieldManager/CParcel', {
            name: 'parcelGeometry',
            type: 'geometry',
            geometryTypes: ['Point', 'LineString', 'Polygon'],
            defaultLatitude: 51.505,
            defaultLongitude: -0.09,
            defaultZoom: 13,
            mapHeight: 400,
        });
    } catch {
        await apiRequest(
            'PUT', 'Admin/fieldManager/CParcel/parcelGeometry',
            {
                type: 'geometry',
                geometryTypes: ['Point', 'LineString', 'Polygon'],
                defaultLatitude: 51.505,
                defaultLongitude: -0.09,
                defaultZoom: 13,
                mapHeight: 400,
            }
        ).catch(() => {});
    }

    try {
        await apiRequest('POST', 'EntityManager/action/createLink', {
            linkType: 'oneToMany',
            entity: 'Account',
            entityForeign: 'CParcel',
            link: accountParcelLink,
            linkForeign: 'account',
            label: 'Parcels',
            labelForeign: 'Account',
        });
    } catch {
        // already exists
    }

    accountParcelLink = resolveAccountParcelLink();

    try {
        await apiRequest('POST', 'Admin/fieldManager/Account', {
            name: 'parcelMap',
            type: 'geometryAggregate',
            link: accountParcelLink,
            mapHeight: 400,
            defaultZoom: 3,
        });
    } catch {
        await apiRequest(
            'PUT', 'Admin/fieldManager/Account/parcelMap',
            {
                type: 'geometryAggregate',
                link: accountParcelLink,
                mapHeight: 400,
                defaultZoom: 3,
            }
        ).catch(() => {});
    }

    try {
        await apiRequest('POST', 'Admin/fieldManager/Account', {
            name: 'parcelDownload',
            type: 'geoDataDownload',
            link: accountParcelLink,
            geometryField: 'parcelGeometry',
            buttonLabel: 'Download KML',
        });
    } catch {
        await apiRequest(
            'PUT', 'Admin/fieldManager/Account/parcelDownload',
            {
                type: 'geoDataDownload',
                link: accountParcelLink,
                geometryField: 'parcelGeometry',
                buttonLabel: 'Download KML',
            }
        ).catch(() => {});
    }
}

function setupLayouts() {
    writeLayout('CParcel', 'detail', [
        {
            label: 'Overview',
            rows: [
                [{name: 'name'}, {name: 'account'}],
                [{name: 'assignedUser'}, {name: 'teams'}],
            ],
        },
        {
            label: 'Geometry',
            rows: [
                [{name: 'parcelGeometry', fullWidth: true}],
            ],
        },
    ]);

    writeLayout('CParcel', 'list', [
        {name: 'name', width: 50, link: true},
        {name: 'parcelGeometry', width: 30},
        {name: 'account', width: 20, link: true},
    ]);

    writeLayout('Account', 'detail', [
        {
            label: 'Overview',
            rows: [
                [{name: 'name'}, {name: 'website'}],
                [{name: 'emailAddress'}, {name: 'phoneNumber'}],
            ],
        },
        {
            label: 'Parcel Map',
            rows: [
                [{name: 'parcelMap', fullWidth: true}],
                [{name: 'parcelDownload', fullWidth: true}],
            ],
        },
    ]);
}

async function rebuild() {
    try {
        await apiRequest('POST', 'Admin/rebuild', {});
    } catch {
        try {
            await apiRequest('POST', 'Admin/clearCache', {});
        } catch {
            // cache will clear on next request
        }
    }
}

let testAccountId;
let testParcelIds = [];
let accountParcelLink = 'cCParcels';

function resolveAccountParcelLink() {
    const accountMetadataPath = path.join(
        projectRoot, 'site', 'custom', 'Espo', 'Custom',
        'Resources', 'metadata', 'entityDefs', 'Account.json'
    );

    if (!fs.existsSync(accountMetadataPath)) {
        return accountParcelLink;
    }

    const metadata = JSON.parse(fs.readFileSync(accountMetadataPath, 'utf8'));

    for (const [linkName, linkDef] of Object.entries(metadata.links || {})) {
        if (linkDef.entity === 'CParcel' && linkDef.type === 'hasMany') {
            return linkName;
        }
    }

    return accountParcelLink;
}

test.describe('Geometry Aggregate Map', () => {

    test.beforeAll(async () => {
        await setupEntityAndFields();
        setupLayouts();
        await rebuild();

        const account = await apiRequest('POST', 'Account', {
            name: 'E2E Test Farm',
        });

        testAccountId = account.id;

        const parcel1 = await apiRequest('POST', 'CParcel', {
            name: 'E2E North Field',
            accountId: testAccountId,
            parcelGeometry: POLYGON_GEOJSON,
        });

        const parcel2 = await apiRequest('POST', 'CParcel', {
            name: 'E2E Well Point',
            accountId: testAccountId,
            parcelGeometry: POINT_GEOJSON,
        });

        testParcelIds = [parcel1.id, parcel2.id];
    });

    test.afterAll(async () => {
        if (keepRecords) {
            return;
        }

        for (const id of testParcelIds) {
            await apiRequest('DELETE', `CParcel/${id}`).catch(() => {});
        }

        if (testAccountId) {
            await apiRequest('DELETE', `Account/${testAccountId}`).catch(
                () => {}
            );
        }
    });

    test('parcel detail view shows geometry map', async ({page}) => {
        await login(page);
        await navigateTo(page, `CParcel/view/${testParcelIds[0]}`);

        const mapContainer = page.locator('.geo-spatial-map-container');
        await expect(mapContainer.first()).toBeVisible({timeout: 15_000});

        const leafletMap = page.locator('.leaflet-container');
        await expect(leafletMap.first()).toBeVisible();
    });

    test('account detail view shows aggregate geometry map with geometries', async ({page}) => {
        await login(page);
        await navigateTo(page, `Account/view/${testAccountId}`);

        const parcelMapSection = page.getByText('Parcel Map');
        await expect(parcelMapSection).toBeVisible({timeout: 15_000});

        const mapContainer = page.locator('.geo-spatial-map-detail');
        await expect(mapContainer.first()).toBeVisible({timeout: 15_000});

        const emptyMessage = page.locator(
            '.geo-spatial-map-detail + .geo-spatial-empty-map'
        );
        await expect(emptyMessage.first()).toBeHidden();

        const leafletMap = page.locator('.leaflet-container');
        await expect(leafletMap.first()).toBeVisible();

        const geometryShapes = page.locator('.leaflet-interactive');
        await expect(geometryShapes.first()).toBeVisible({timeout: 10_000});

        const shapeCount = await geometryShapes.count();
        expect(
            shapeCount,
            'Expected at least 2 geometry shapes on the aggregate map ' +
            '(1 polygon + 1 marker)'
        ).toBeGreaterThanOrEqual(2);
    });

    test('aggregate map loads geometries via API', async ({page}) => {
        await login(page);

        const apiPromise = page.waitForResponse(
            (response) =>
                response.url().includes(
                    `/Account/${testAccountId}/${accountParcelLink}`
                ) && response.status() === 200
        );

        await navigateTo(page, `Account/view/${testAccountId}`);

        const response = await apiPromise;
        const data = await response.json();

        expect(data.total).toBeGreaterThanOrEqual(2);

        const names = data.list.map((r) => r.name);
        expect(names).toContain('E2E North Field');
        expect(names).toContain('E2E Well Point');
    });

    test('account detail view downloads related parcel geometries as KML', async ({page}) => {
        await login(page);
        await navigateTo(page, `Account/view/${testAccountId}`);

        const downloadButton = page.locator('.geo-spatial-download-kml');
        await expect(downloadButton).toBeVisible({timeout: 15_000});

        const downloadPromise = page.waitForEvent('download');
        await downloadButton.click();

        const download = await downloadPromise;
        const filename = download.suggestedFilename();

        expect(filename).toMatch(/^Account-E2E-Test-Farm-.+-parcels\.kml$/);

        const downloadPath = await download.path();
        const content = fs.readFileSync(downloadPath, 'utf8');

        expect(content).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">');
        expect(content).toContain('<Document>');
        expect(content).toContain('<Placemark>');
        expect(content).toContain('<name>E2E North Field</name>');
        expect(content).toContain('<name>E2E Well Point</name>');
        expect(content).toContain('<Polygon>');
        expect(content).toContain('<Point>');
        expect(content).toContain(`#CParcel/view/${testParcelIds[0]}`);
        expect(content).toContain(`#CParcel/view/${testParcelIds[1]}`);
        expect(content).toContain('-0.095,51.508');
    });

    test('parcel geometry badge shows in list view', async ({page}) => {
        await login(page);
        await navigateTo(page, 'CParcel');

        const listTable = page.locator('.list-row');
        await expect(listTable.first()).toBeVisible({timeout: 15_000});

        const badge = page.locator('.geo-spatial-geometry-badge');
        await expect(badge.first()).toBeVisible({timeout: 10_000});
    });
});
