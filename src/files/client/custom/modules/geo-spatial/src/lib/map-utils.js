import L from 'leaflet';
import 'leaflet-draw';

const IMAGE_PATH = 'client/custom/modules/geo-spatial/css/images/';
const MAPBOX_STYLE_TILE_URL =
    'https://api.mapbox.com/styles/v1/thimmzwiener/cl4zotovl005m14llqu2u6vb5/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoidGhpbW16d2llbmVyIiwiYSI6ImNrb3pyeXVjeDA2dnIyb3RlY2N2eXA4dDEifQ.cdA5OWTSQFB07atpOOAZdQ';
const DEFAULT_ATTRIBUTION = '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> ' +
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

if (L.Icon && L.Icon.Default) {
    L.Icon.Default.mergeOptions({
        imagePath: IMAGE_PATH,
        iconUrl: IMAGE_PATH + 'marker-icon.png',
        iconRetinaUrl: IMAGE_PATH + 'marker-icon-2x.png',
        shadowUrl: IMAGE_PATH + 'marker-shadow.png',
    });
}

const GEOMETRY_STYLES = {
    default: {
        color: '#3388ff',
        weight: 3,
        opacity: 0.8,
        fillOpacity: 0.25,
    },
    highlight: {
        color: '#ff7800',
        weight: 4,
        opacity: 1.0,
        fillOpacity: 0.35,
    },
};

const GEOMETRY_TYPE_ICONS = {
    Point: 'fas fa-map-marker-alt',
    LineString: 'fas fa-route',
    Polygon: 'fas fa-draw-polygon',
};

/**
 * @param {HTMLElement} container
 * @param {Object} options
 * @param {number[]} [options.center]
 * @param {number} [options.zoom]
 * @param {string} [options.tileUrl]
 * @returns {L.Map}
 */
function createMap(container, options = {}) {
    const center = options.center || [51.505, -0.09];
    const zoom = options.zoom || 13;
    const tileUrl = options.tileUrl || MAPBOX_STYLE_TILE_URL;

    const map = L.map(container, {
        center: center,
        zoom: zoom,
        scrollWheelZoom: true,
    });

    L.tileLayer(tileUrl, {
        attribution: options.attribution || DEFAULT_ATTRIBUTION,
        maxZoom: 22,
    }).addTo(map);

    return map;
}

/**
 * @param {L.Map} map
 * @param {Object} geojson - GeoJSON Feature or Geometry
 * @param {Object} [style]
 * @returns {L.GeoJSON|null}
 */
function addGeoJsonLayer(map, geojson, style) {
    if (!geojson) {
        return null;
    }

    const layerStyle = style || GEOMETRY_STYLES.default;

    const layer = L.geoJSON(geojson, {
        style: () => layerStyle,
        pointToLayer: (feature, latlng) => {
            return L.marker(latlng);
        },
    });

    layer.addTo(map);

    return layer;
}

/**
 * @param {L.Map} map
 * @param {L.Layer} layer
 * @param {Object} [options]
 */
function fitToLayer(map, layer, options = {}) {
    if (!layer) {
        return;
    }

    const bounds = layer.getBounds();

    if (!bounds.isValid()) {
        return;
    }

    const padding = options.padding || [30, 30];

    map.fitBounds(bounds, {
        padding: padding,
        maxZoom: options.maxZoom || 16,
    });
}

/**
 * @param {L.Map} map
 * @param {L.FeatureGroup} drawnItems
 * @param {string[]} geometryTypes
 * @returns {L.Control.Draw}
 */
function createDrawControl(map, drawnItems, geometryTypes) {
    const allowedTypes = geometryTypes || ['Point', 'LineString', 'Polygon'];

    const drawOptions = {
        position: 'topright',
        draw: {
            polyline: allowedTypes.includes('LineString') ? {
                shapeOptions: GEOMETRY_STYLES.default,
            } : false,
            polygon: allowedTypes.includes('Polygon') ? {
                allowIntersection: false,
                drawError: {
                    color: '#e1e100',
                    message: 'Polygon edges cannot cross.',
                },
                shapeOptions: GEOMETRY_STYLES.default,
            } : false,
            circle: false,
            circlemarker: false,
            rectangle: allowedTypes.includes('Polygon') ? {
                shapeOptions: GEOMETRY_STYLES.default,
            } : false,
            marker: allowedTypes.includes('Point') ? {} : false,
        },
        edit: {
            featureGroup: drawnItems,
            remove: true,
        },
    };

    const control = new L.Control.Draw(drawOptions);
    map.addControl(control);

    return control;
}

/**
 * @param {L.FeatureGroup} featureGroup
 * @returns {Object|null} GeoJSON Feature or null
 */
function extractGeoJson(featureGroup) {
    const layers = featureGroup.getLayers();

    if (layers.length === 0) {
        return null;
    }

    if (layers.length === 1) {
        return layers[0].toGeoJSON();
    }

    const features = [];

    featureGroup.eachLayer((layer) => {
        features.push(layer.toGeoJSON());
    });

    return {
        type: 'FeatureCollection',
        features: features,
    };
}

/**
 * @param {Object} geojson
 * @returns {string}
 */
function getGeometryTypeLabel(geojson) {
    if (!geojson) {
        return '';
    }

    if (geojson.type === 'FeatureCollection') {
        const count = geojson.features ? geojson.features.length : 0;

        return count + ' feature' + (count !== 1 ? 's' : '');
    }

    const geomType = geojson.type === 'Feature'
        ? geojson.geometry?.type
        : geojson.type;

    return geomType || 'Geometry';
}

/**
 * @param {string} geometryType
 * @returns {string}
 */
function getGeometryIcon(geometryType) {
    return GEOMETRY_TYPE_ICONS[geometryType] || 'fas fa-globe';
}

export {
    createMap,
    addGeoJsonLayer,
    fitToLayer,
    createDrawControl,
    extractGeoJson,
    getGeometryTypeLabel,
    getGeometryIcon,
    GEOMETRY_STYLES,
};

export default {
    createMap,
    addGeoJsonLayer,
    fitToLayer,
    createDrawControl,
    extractGeoJson,
    getGeometryTypeLabel,
    getGeometryIcon,
    GEOMETRY_STYLES,
};
