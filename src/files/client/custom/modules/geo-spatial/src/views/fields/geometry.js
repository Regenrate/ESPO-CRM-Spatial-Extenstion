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
    `

    editTemplateContent = `
        <div class="geo-spatial-map-container geo-spatial-map-edit"
             style="height: {{mapHeight}}px;">
            <div class="geo-spatial-map-el" style="width:100%;height:100%;"></div>
        </div>
        <input type="hidden"
               name="{{name}}"
               value="{{value}}">
    `

    _map = null
    _drawnItems = null
    _geoJsonLayer = null
    _drawControl = null
    _initialGeoJson = null

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
        }
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
        });

        this._map.on(L.Draw.Event.EDITED, () => {
            this._syncModelValue();
        });

        this._map.on(L.Draw.Event.DELETED, () => {
            this._syncModelValue();
        });
    }

    _syncModelValue() {
        const geojson = MapUtils.extractGeoJson(this._drawnItems);
        const value = geojson ? JSON.stringify(geojson) : null;

        this.model.set(this.name, value, {ui: true});
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
    }

    fetch() {
        const data = {};

        if (this._drawnItems) {
            const geojson = MapUtils.extractGeoJson(this._drawnItems);
            data[this.name] = geojson ? JSON.stringify(geojson) : null;
        } else {
            data[this.name] = this.model.get(this.name) || null;
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
}
