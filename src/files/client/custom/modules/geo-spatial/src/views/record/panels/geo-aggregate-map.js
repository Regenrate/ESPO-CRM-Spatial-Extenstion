import BottomPanelView from 'views/record/panels/bottom';
import MapUtils from 'modules/geo-spatial/lib/map-utils';
import L from 'leaflet';
import Ajax from 'ajax';

export default class GeoAggregateMapPanel extends BottomPanelView {

    templateContent = `
        <div class="geo-spatial-map-container geo-spatial-map-panel">
            <div class="geo-spatial-map-el" style="width:100%;height:100%;"></div>
        </div>
        <div class="geo-spatial-empty-map" style="display:none;">
            {{emptyMessage}}
        </div>
    `

    _map = null
    _layers = []

    data() {
        return {
            emptyMessage: this.translate(
                'No geometries found',
                'labels',
                'GeoSpatial'
            ),
        };
    }

    setup() {
        super.setup();

        const panelDefs = this.options.defs || this.defs || {};
        const panelOptions = panelDefs.options || {};

        this._link = panelOptions.link || null;
        this._geometryFields = panelOptions.geometryFields || [];
        this._droneRestrictionsEnabled =
            panelOptions.droneRestrictionsEnabled === true ||
            panelOptions.droneRestrictionsEnabled === 'true';
        this._droneRestrictionsDefaultOn =
            panelOptions.droneRestrictionsDefaultOn === true ||
            panelOptions.droneRestrictionsDefaultOn === 'true';
    }

    afterRender() {
        super.afterRender();

        if (!this._link) {
            this._showEmpty();
            return;
        }

        this._loadRelatedGeometries();
    }

    _loadRelatedGeometries() {
        const parentId = this.model.id;
        const parentType = this.model.entityType;

        if (!parentId) {
            this._showEmpty();
            return;
        }

        const url = `${parentType}/${parentId}/${this._link}`;

        const selectFields = ['id', 'name'];

        this._geometryFields.forEach((f) => {
            if (!selectFields.includes(f)) {
                selectFields.push(f);
            }
        });

        Ajax.getRequest(url, {
            select: selectFields.join(','),
            maxSize: 200,
            orderBy: 'createdAt',
            order: 'desc',
        }).then((response) => {
            const records = response.list || [];

            this._renderMap(records);
        }).catch(() => {
            this._showEmpty();
        });
    }

    _renderMap(records) {
        const features = [];

        records.forEach((record) => {
            this._geometryFields.forEach((fieldName) => {
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

                if (!geojson) {
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
                } else {
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

        if (features.length === 0) {
            this._showEmpty();
            return;
        }

        this._showMap();
        this._initMap(features);
    }

    _initMap(features) {
        const mapEl = this.element?.querySelector('.geo-spatial-map-el');

        if (!mapEl) {
            return;
        }

        if (this._map) {
            this._map.remove();
            this._map = null;
        }

        this._map = MapUtils.createMap(mapEl, {
            center: [51.505, -0.09],
            zoom: 3,
        });

        MapUtils.addDroneRestrictionsControl(this._map, {
            enabled: this._droneRestrictionsEnabled,
            defaultOn: this._droneRestrictionsDefaultOn,
            label: 'Drone restrictions',
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
            onEachFeature: (feature, layer) => {
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

                layer.bindPopup(popupContent);
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

    onRemove() {
        if (this._map) {
            this._map.remove();
            this._map = null;
        }

        this._layers = [];

        if (super.onRemove) {
            super.onRemove();
        }
    }
}
