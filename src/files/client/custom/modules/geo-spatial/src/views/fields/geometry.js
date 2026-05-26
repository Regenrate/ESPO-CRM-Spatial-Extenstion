import TextFieldView from 'views/fields/text';
import MapUtils from 'modules/geo-spatial/lib/map-utils';
import L from 'leaflet';
import 'leaflet-draw';

export default class GeometryFieldView extends TextFieldView {

    listTemplateContent = `
        {{#if geometryLabel}}
        <span class="geo-spatial-geometry-badge">
            <span class="{{geometryIcon}}"></span> {{geometryLabel}}
        </span>
        {{/if}}
    `

    detailTemplateContent = `
        {{#if hasValue}}
        <div class="geo-spatial-map-container geo-spatial-map-detail"
             style="height: {{mapHeight}}px;">
            <div class="geo-spatial-map-el" style="width:100%;height:100%;"></div>
        </div>
        {{else}}
        <div class="geo-spatial-empty-map">No geometry defined</div>
        {{/if}}
        {{#if hasDroneRestrictionSnapshot}}
        <div class="geo-spatial-drone-snapshot">
            <div class="geo-spatial-drone-snapshot-title">
                Stored drone restrictions
            </div>
            <div class="geo-spatial-drone-snapshot-meta">
                {{droneRestrictionSnapshotCountLabel}}
                {{#if droneRestrictionSnapshotCapturedAt}}
                · {{droneRestrictionSnapshotCapturedAt}}
                {{/if}}
            </div>
            {{#if hasDroneRestrictionSnapshotItems}}
            <ul class="geo-spatial-drone-snapshot-list">
                {{#each droneRestrictionSnapshotItems}}
                <li>
                    {{#if limite}}
                    <div><strong>Limit:</strong> {{limite}}</div>
                    {{/if}}
                    {{#if remarque}}
                    <div><strong>Note:</strong> {{remarque}}</div>
                    {{/if}}
                    {{#unless hasDetails}}
                    <div>No details provided.</div>
                    {{/unless}}
                </li>
                {{/each}}
            </ul>
            {{else}}
            <div class="geo-spatial-drone-snapshot-empty">
                No overlapping restrictions were stored.
            </div>
            {{/if}}
        </div>
        {{/if}}
    `

    editTemplateContent = `
        <div class="geo-spatial-map-container geo-spatial-map-edit"
             style="height: {{mapHeight}}px;">
            <div class="geo-spatial-map-el" style="width:100%;height:100%;"></div>
        </div>
        {{#if showDroneRestrictionControls}}
        <div class="geo-spatial-drone-controls">
            <button type="button"
                    class="btn btn-default btn-xs geo-spatial-drone-check">
                Check drone restrictions
            </button>
            {{#if droneRestrictionsStorageField}}
            <label class="geo-spatial-drone-store">
                <input type="checkbox"
                       class="geo-spatial-drone-store-checkbox"
                       {{#if droneRestrictionsStoreByDefault}}checked{{/if}}>
                Store snapshot
            </label>
            {{/if}}
            <span class="geo-spatial-drone-status"></span>
        </div>
        {{/if}}
        <input type="hidden"
               name="{{name}}"
               value="{{value}}">
    `

    _map = null
    _drawnItems = null
    _geoJsonLayer = null
    _drawControl = null
    _initialGeoJson = null
    _droneRestrictionSnapshot = null
    _droneRestrictionSnapshotValue = null
    _droneRestrictionLookupPromise = null
    _droneRestrictionCaptureEnabled = false

    data() {
        const data = super.data();

        const rawValue = this.model.get(this.name);
        let geojson = null;

        if (rawValue) {
            try {
                geojson = typeof rawValue === 'string'
                    ? JSON.parse(rawValue) : rawValue;
            } catch (e) {
                // invalid JSON
            }
        }

        data.hasValue = !!geojson;
        data.geometryLabel = MapUtils.getGeometryTypeLabel(geojson);
        data.value = rawValue || '';
        data.mapHeight = this.params.mapHeight || 400;
        data.showDroneRestrictionControls =
            this.isEditMode() && this._areDroneRestrictionsEnabled();
        data.droneRestrictionsStorageField =
            this._getDroneRestrictionsStorageField();
        data.droneRestrictionsStoreByDefault =
            this._shouldStoreDroneRestrictionsByDefault();

        const droneRestrictionSnapshot =
            this._getStoredDroneRestrictionSnapshot();

        data.hasDroneRestrictionSnapshot = !!droneRestrictionSnapshot;
        data.droneRestrictionSnapshotItems = [];
        data.hasDroneRestrictionSnapshotItems = false;
        data.droneRestrictionSnapshotCapturedAt = null;
        data.droneRestrictionSnapshotCountLabel = null;

        if (droneRestrictionSnapshot) {
            const restrictions = droneRestrictionSnapshot.restrictions || [];
            const count = Number.isFinite(droneRestrictionSnapshot.count)
                ? droneRestrictionSnapshot.count
                : restrictions.length;

            data.droneRestrictionSnapshotItems = restrictions.map((item) => {
                return {
                    limite: item.limite || null,
                    remarque: item.remarque || null,
                    hasDetails: !!(item.limite || item.remarque),
                };
            });
            data.hasDroneRestrictionSnapshotItems =
                data.droneRestrictionSnapshotItems.length > 0;
            data.droneRestrictionSnapshotCapturedAt =
                this._formatSnapshotDate(droneRestrictionSnapshot.capturedAt);
            data.droneRestrictionSnapshotCountLabel = count === 1
                ? '1 overlapping restriction stored'
                : `${count} overlapping restrictions stored`;
        }

        if (geojson) {
            const geomType = geojson.type === 'Feature'
                ? geojson.geometry?.type
                : geojson.type;

            data.geometryIcon = MapUtils.getGeometryIcon(geomType);
        } else {
            data.geometryIcon = 'fas fa-globe';
        }

        return data;
    }

    afterRender() {
        super.afterRender();

        if (this.isListMode()) {
            return;
        }

        this._destroyMap();

        const mapEl = this.element?.querySelector('.geo-spatial-map-el');

        if (!mapEl) {
            return;
        }

        setTimeout(() => {
            this._initMap(mapEl);
        }, 50);
    }

    _initMap(container) {
        const defaultLat = this.params.defaultLatitude || 51.505;
        const defaultLng = this.params.defaultLongitude || -0.09;
        const defaultZoom = this.params.defaultZoom || 13;

        this._map = MapUtils.createMap(container, {
            center: [defaultLat, defaultLng],
            zoom: defaultZoom,
        });

        this._initDroneRestrictionsOverlay();

        const rawValue = this.model.get(this.name);

        if (rawValue) {
            let geojson;

            try {
                geojson = typeof rawValue === 'string'
                    ? JSON.parse(rawValue) : rawValue;
            } catch (e) {
                return;
            }

            if (geojson) {
                if (this.isEditMode()) {
                    this._initialGeoJson = geojson;
                } else {
                    this._geoJsonLayer = MapUtils.addGeoJsonLayer(
                        this._map, geojson
                    );

                    MapUtils.fitToLayer(this._map, this._geoJsonLayer);
                }
            }
        }

        if (this.isEditMode()) {
            this._initDrawing();
            this._initDroneRestrictionControls();
        }
    }

    _initDroneRestrictionsOverlay() {
        MapUtils.addDroneRestrictionsControl(this._map, {
            enabled: this._areDroneRestrictionsEnabled(),
            defaultOn: this._areDroneRestrictionsDefaultOn(),
            label: 'Drone restrictions',
        });
    }

    _initDrawing() {
        this._drawnItems = new L.FeatureGroup();
        this._map.addLayer(this._drawnItems);

        if (this._initialGeoJson) {
            const editableLayer = L.geoJSON(this._initialGeoJson, {
                style: () => MapUtils.GEOMETRY_STYLES.default,
                pointToLayer: (feature, latlng) => L.marker(latlng),
            });

            editableLayer.eachLayer((layer) => {
                this._drawnItems.addLayer(layer);
            });

            MapUtils.fitToLayer(this._map, this._drawnItems);
        }

        const geometryTypes = this.params.geometryTypes ||
            ['Point', 'LineString', 'Polygon'];

        this._drawControl = MapUtils.createDrawControl(
            this._map, this._drawnItems, geometryTypes
        );

        this._map.on(L.Draw.Event.CREATED, (e) => {
            this._drawnItems.clearLayers();
            this._drawnItems.addLayer(e.layer);
            this._syncModelValue();
            this._markDroneRestrictionLookupStale();
        });

        this._map.on(L.Draw.Event.EDITED, () => {
            this._syncModelValue();
            this._markDroneRestrictionLookupStale();
        });

        this._map.on(L.Draw.Event.DELETED, () => {
            this._syncModelValue();
            this._markDroneRestrictionLookupStale();
        });
    }

    _initDroneRestrictionControls() {
        if (!this._areDroneRestrictionsEnabled()) {
            return;
        }

        const checkButton = this.element?.querySelector(
            '.geo-spatial-drone-check'
        );
        const storeCheckbox = this.element?.querySelector(
            '.geo-spatial-drone-store-checkbox'
        );

        if (storeCheckbox) {
            this._droneRestrictionCaptureEnabled = storeCheckbox.checked;

            storeCheckbox.addEventListener('change', () => {
                this._droneRestrictionCaptureEnabled = storeCheckbox.checked;

                if (storeCheckbox.checked && !this._droneRestrictionSnapshot) {
                    this._refreshDroneRestrictionLookup();
                }
            });

            if (storeCheckbox.checked) {
                this._refreshDroneRestrictionLookup();
            }
        }

        if (checkButton) {
            checkButton.addEventListener('click', () => {
                this._refreshDroneRestrictionLookup();
            });
        }

        this._updateDroneRestrictionStatus();
    }

    _refreshDroneRestrictionLookup() {
        const geojson = this._getCurrentGeoJson();
        const geojsonValue = geojson ? JSON.stringify(geojson) : null;

        if (!geojson || !MapUtils.hasAreaGeometry(geojson)) {
            this._droneRestrictionSnapshot = null;
            this._droneRestrictionSnapshotValue = null;
            this._updateDroneRestrictionStatus('Draw a polygon first.');

            return;
        }

        this._updateDroneRestrictionStatus('Checking...');

        const lookupPromise = MapUtils.fetchDroneRestrictionOverlaps(geojson)
            .then((restrictions) => {
                if (this._droneRestrictionLookupPromise !== lookupPromise) {
                    return;
                }

                this._droneRestrictionSnapshot = {
                    source: 'TRANSPORTS.DRONES.RESTRICTIONS',
                    sourceType: 'GeoPlateforme WFS',
                    capturedAt: new Date().toISOString(),
                    geometryField: this.name,
                    count: restrictions.length,
                    restrictions: restrictions,
                };
                this._droneRestrictionSnapshotValue = geojsonValue;

                const count = restrictions.length;
                const label = count === 1
                    ? '1 restriction found.'
                    : `${count} restrictions found.`;

                this._updateDroneRestrictionStatus(label);
            })
            .catch(() => {
                if (this._droneRestrictionLookupPromise !== lookupPromise) {
                    return;
                }

                this._droneRestrictionSnapshot = null;
                this._droneRestrictionSnapshotValue = null;
                this._updateDroneRestrictionStatus('Lookup failed.');
            })
            .finally(() => {
                if (this._droneRestrictionLookupPromise === lookupPromise) {
                    this._droneRestrictionLookupPromise = null;
                }
            });

        this._droneRestrictionLookupPromise = lookupPromise;
    }

    _markDroneRestrictionLookupStale() {
        this._droneRestrictionSnapshot = null;
        this._droneRestrictionSnapshotValue = null;

        if (this._areDroneRestrictionsEnabled()) {
            this._updateDroneRestrictionStatus('Refresh needed.');
        }
    }

    _updateDroneRestrictionStatus(message) {
        const statusEl = this.element?.querySelector(
            '.geo-spatial-drone-status'
        );

        if (!statusEl) {
            return;
        }

        statusEl.textContent = message || '';
    }

    _syncModelValue() {
        const geojson = this._getCurrentGeoJson();
        const value = geojson ? JSON.stringify(geojson) : null;

        this.model.set(this.name, value, {ui: true});
    }

    _getCurrentGeoJson() {
        if (!this._drawnItems) {
            return null;
        }

        return MapUtils.extractGeoJson(this._drawnItems);
    }

    _destroyMap() {
        if (this._map) {
            this._map.remove();
            this._map = null;
        }

        this._drawnItems = null;
        this._geoJsonLayer = null;
        this._drawControl = null;
        this._initialGeoJson = null;
        this._droneRestrictionSnapshot = null;
        this._droneRestrictionSnapshotValue = null;
        this._droneRestrictionLookupPromise = null;
        this._droneRestrictionCaptureEnabled = false;
    }

    fetch() {
        const data = {};

        if (this._drawnItems) {
            const geojson = MapUtils.extractGeoJson(this._drawnItems);
            data[this.name] = geojson ? JSON.stringify(geojson) : null;
        } else {
            data[this.name] = this.model.get(this.name) || null;
        }

        const storageField = this._getDroneRestrictionsStorageField();
        const currentGeoJson = this._drawnItems
            ? MapUtils.extractGeoJson(this._drawnItems) : null;
        const currentValue = currentGeoJson ? JSON.stringify(currentGeoJson) : null;

        if (
            storageField &&
            this._droneRestrictionCaptureEnabled &&
            this._droneRestrictionSnapshot &&
            this._droneRestrictionSnapshotValue === currentValue
        ) {
            data[storageField] = JSON.stringify(this._droneRestrictionSnapshot);
        }

        return data;
    }

    onRemove() {
        this._destroyMap();

        if (super.onRemove) {
            super.onRemove();
        }
    }

    isListMode() {
        return this.mode === 'list' || this.mode === 'listLink';
    }

    isEditMode() {
        return this.mode === 'edit';
    }

    _areDroneRestrictionsEnabled() {
        return this.params.droneRestrictionsEnabled === true ||
            this.params.droneRestrictionsEnabled === 'true' ||
            this._getFieldParam('droneRestrictionsEnabled') === true ||
            this._getFieldParam('droneRestrictionsEnabled') === 'true';
    }

    _areDroneRestrictionsDefaultOn() {
        return this.params.droneRestrictionsDefaultOn === true ||
            this.params.droneRestrictionsDefaultOn === 'true' ||
            this._getFieldParam('droneRestrictionsDefaultOn') === true ||
            this._getFieldParam('droneRestrictionsDefaultOn') === 'true';
    }

    _getDroneRestrictionsStorageField() {
        return this.params.droneRestrictionsStorageField ||
            this._getFieldParam('droneRestrictionsStorageField') ||
            null;
    }

    _shouldStoreDroneRestrictionsByDefault() {
        return this.params.droneRestrictionsStoreByDefault === true ||
            this.params.droneRestrictionsStoreByDefault === 'true' ||
            this._getFieldParam('droneRestrictionsStoreByDefault') === true ||
            this._getFieldParam('droneRestrictionsStoreByDefault') === 'true';
    }

    _getStoredDroneRestrictionSnapshot() {
        const storageField = this._getDroneRestrictionsStorageField();

        if (!storageField) {
            return null;
        }

        const rawValue = this.model.get(storageField);

        if (!rawValue) {
            return null;
        }

        try {
            const snapshot = typeof rawValue === 'string'
                ? JSON.parse(rawValue)
                : rawValue;

            if (
                snapshot &&
                snapshot.source === 'TRANSPORTS.DRONES.RESTRICTIONS' &&
                Array.isArray(snapshot.restrictions)
            ) {
                return snapshot;
            }
        } catch (e) {
            return null;
        }

        return null;
    }

    _formatSnapshotDate(value) {
        if (!value) {
            return null;
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return null;
        }

        return date.toLocaleString();
    }

    _getFieldParam(param) {
        const metadata = this.getMetadata();

        if (!metadata) {
            return null;
        }

        const entityType = this.model.entityType || this.model.name;

        return metadata.get(
            ['entityDefs', entityType, 'fields', this.name, param]
        ) || null;
    }
}
