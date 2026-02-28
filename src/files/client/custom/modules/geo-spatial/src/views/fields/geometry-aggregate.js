import BaseFieldView from 'views/fields/base';
import MapUtils from 'modules/geo-spatial/lib/map-utils';
import L from 'leaflet';
import Ajax from 'ajax';

export default class GeometryAggregateFieldView extends BaseFieldView {

    listTemplateContent = `
        {{#if featureCount}}
        <span class="geo-spatial-geometry-badge">
            <span class="fas fa-layer-group"></span> {{featureCount}} geometries
        </span>
        {{else}}
        <span class="text-muted">{{emptyMessage}}</span>
        {{/if}}
    `

    detailTemplateContent = `
        <div class="geo-spatial-map-container geo-spatial-map-detail"
             style="height: {{mapHeight}}px;">
            <div class="geo-spatial-map-el" style="width:100%;height:100%;"></div>
        </div>
        <div class="geo-spatial-empty-map" style="display:none;">
            {{emptyMessage}}
        </div>
    `

    editTemplateContent = `
        <div class="geo-spatial-map-container geo-spatial-map-detail"
             style="height: {{mapHeight}}px;">
            <div class="geo-spatial-map-el" style="width:100%;height:100%;"></div>
        </div>
        <div class="geo-spatial-empty-map" style="display:none;">
            {{emptyMessage}}
        </div>
    `

    _map = null
    _layers = []
    _features = []

    data() {
        const data = super.data();

        data.mapHeight = this.params.mapHeight || 400;
        data.featureCount = this._features.length || 0;
        data.emptyMessage = this.translate(
            'No geometries found', 'labels', 'GeoSpatial'
        );

        return data;
    }

    setup() {
        super.setup();

        this._link = this.params.link
            || this._getFieldParam('link')
            || null;

        this._geometryFields = this._detectGeometryFields();
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

    afterRender() {
        super.afterRender();

        if (this._isListMode()) {
            return;
        }

        this._destroyMap();

        if (!this._link) {
            this._showEmpty();
            return;
        }

        this._loadRelatedGeometries();
    }

    _detectGeometryFields() {
        if (!this._link) {
            return [];
        }

        const metadata = this.getMetadata();

        if (!metadata) {
            return [];
        }

        const entityType = this.model.entityType || this.model.name;
        const foreignEntity = metadata.get(
            ['entityDefs', entityType, 'links', this._link, 'entity']
        );

        if (!foreignEntity) {
            return [];
        }

        const fields = metadata.get(
            ['entityDefs', foreignEntity, 'fields']
        ) || {};

        const geometryFields = [];

        for (const [fieldName, fieldDef] of Object.entries(fields)) {
            if (fieldDef.type === 'geometry') {
                geometryFields.push(fieldName);
            }
        }

        return geometryFields;
    }

    _loadRelatedGeometries() {
        const parentId = this.model.id;
        const parentType = this.model.entityType;

        if (!parentId) {
            this._showEmpty();
            return;
        }

        const url = `${parentType}/${parentId}/${this._link}`;

        const params = {
            maxSize: 200,
            orderBy: 'createdAt',
            order: 'desc',
        };

        if (this._geometryFields.length > 0) {
            const selectFields = ['id', 'name'];

            this._geometryFields.forEach((f) => {
                if (!selectFields.includes(f)) {
                    selectFields.push(f);
                }
            });

            params.select = selectFields.join(',');
        }

        Ajax.getRequest(url, params).then((response) => {
            const records = response.list || [];

            this._processRecords(records);
        }).catch(() => {
            this._showEmpty();
        });
    }

    _processRecords(records) {
        const features = [];

        records.forEach((record) => {
            const fieldsToScan = this._geometryFields.length > 0
                ? this._geometryFields
                : this._guessGeometryFields(record);

            fieldsToScan.forEach((fieldName) => {
                const rawValue = record[fieldName];

                if (!rawValue) {
                    return;
                }

                let geojson;

                try {
                    geojson = typeof rawValue === 'string'
                        ? JSON.parse(rawValue) : rawValue;
                } catch (e) {
                    return;
                }

                if (!geojson || !geojson.type) {
                    return;
                }

                const recordName = record.name || record.id;
                const recordId = record.id;

                if (geojson.type === 'FeatureCollection' && geojson.features) {
                    geojson.features.forEach((feature) => {
                        feature.properties = feature.properties || {};
                        feature.properties._recordId = recordId;
                        feature.properties._recordName = recordName;

                        features.push(feature);
                    });
                } else if (geojson.type === 'Feature') {
                    geojson.properties = geojson.properties || {};
                    geojson.properties._recordId = recordId;
                    geojson.properties._recordName = recordName;

                    features.push(geojson);
                } else if (this._isGeometryType(geojson.type)) {
                    features.push({
                        type: 'Feature',
                        geometry: geojson,
                        properties: {
                            _recordId: recordId,
                            _recordName: recordName,
                        },
                    });
                }
            });
        });

        this._features = features;

        if (features.length === 0) {
            this._showEmpty();
            return;
        }

        this._showMap();
        this._initMap(features);
    }

    _guessGeometryFields(record) {
        const candidates = [];
        const skipKeys = new Set([
            'id', 'name', 'deleted', 'createdAt', 'modifiedAt',
            'createdById', 'createdByName', 'modifiedById', 'modifiedByName',
            'assignedUserId', 'assignedUserName',
        ]);

        for (const [key, value] of Object.entries(record)) {
            if (skipKeys.has(key) || key.endsWith('Id') || key.endsWith('Name')) {
                continue;
            }

            if (typeof value !== 'string' || value.length < 10) {
                continue;
            }

            if (value.charAt(0) !== '{') {
                continue;
            }

            try {
                const parsed = JSON.parse(value);

                if (parsed && parsed.type && (
                    parsed.type === 'Feature' ||
                    parsed.type === 'FeatureCollection' ||
                    this._isGeometryType(parsed.type)
                )) {
                    candidates.push(key);
                }
            } catch (e) {
                // not JSON
            }
        }

        return candidates;
    }

    _isGeometryType(type) {
        const geomTypes = [
            'Point', 'LineString', 'Polygon',
            'MultiPoint', 'MultiLineString', 'MultiPolygon',
            'GeometryCollection',
        ];

        return geomTypes.includes(type);
    }

    _initMap(features) {
        const mapEl = this.element?.querySelector('.geo-spatial-map-el');

        if (!mapEl) {
            return;
        }

        const defaultZoom = this.params.defaultZoom || 3;

        this._map = MapUtils.createMap(mapEl, {
            center: [51.505, -0.09],
            zoom: defaultZoom,
        });

        const featureCollection = {
            type: 'FeatureCollection',
            features: features,
        };

        const entityType = this._getRelatedEntityType();

        const layer = L.geoJSON(featureCollection, {
            style: () => MapUtils.GEOMETRY_STYLES.default,
            pointToLayer: (feature, latlng) => {
                return L.marker(latlng);
            },
            onEachFeature: (feature, featureLayer) => {
                const props = feature.properties || {};
                const name = props._recordName || 'Record';
                const id = props._recordId;

                let popupContent = `<strong>${this._escapeHtml(name)}</strong>`;

                if (id && entityType) {
                    const href = `#${entityType}/view/${id}`;

                    popupContent =
                        `<a class="geo-spatial-popup-link" href="${href}">` +
                        `${this._escapeHtml(name)}</a>`;
                }

                featureLayer.bindPopup(popupContent);
            },
        });

        layer.addTo(this._map);
        this._layers.push(layer);

        MapUtils.fitToLayer(this._map, layer);
    }

    _getRelatedEntityType() {
        const metadata = this.getMetadata();

        if (!metadata) {
            return null;
        }

        const entityType = this.model.entityType || this.model.name;

        return metadata.get(
            ['entityDefs', entityType, 'links', this._link, 'entity']
        ) || null;
    }

    _showEmpty() {
        const mapContainer = this.element?.querySelector(
            '.geo-spatial-map-container'
        );
        const emptyEl = this.element?.querySelector('.geo-spatial-empty-map');

        if (mapContainer) {
            mapContainer.style.display = 'none';
        }

        if (emptyEl) {
            emptyEl.style.display = '';
        }
    }

    _showMap() {
        const mapContainer = this.element?.querySelector(
            '.geo-spatial-map-container'
        );
        const emptyEl = this.element?.querySelector('.geo-spatial-empty-map');

        if (mapContainer) {
            mapContainer.style.display = '';
        }

        if (emptyEl) {
            emptyEl.style.display = 'none';
        }
    }

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;

        return div.innerHTML;
    }

    _destroyMap() {
        if (this._map) {
            this._map.remove();
            this._map = null;
        }

        this._layers = [];
    }

    _isListMode() {
        return this.mode === 'list' || this.mode === 'listLink';
    }

    fetch() {
        return {};
    }

    onRemove() {
        this._destroyMap();

        if (super.onRemove) {
            super.onRemove();
        }
    }
}
