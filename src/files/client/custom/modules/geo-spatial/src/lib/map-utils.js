import L from 'leaflet';
import 'leaflet-draw';

const IMAGE_PATH = 'client/custom/modules/geo-spatial/css/images/';
const MAPBOX_STYLE_TILE_URL =
    'https://api.mapbox.com/styles/v1/thimmzwiener/cl4zotovl005m14llqu2u6vb5/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoidGhpbW16d2llbmVyIiwiYSI6ImNrb3pyeXVjeDA2dnIyb3RlY2N2eXA4dDEifQ.cdA5OWTSQFB07atpOOAZdQ';
const DEFAULT_ATTRIBUTION = '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> ' +
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const DRONE_RESTRICTIONS_TILE_URL =
    'https://data.geopf.fr/wmts?' +
    'SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
    '&LAYER=TRANSPORTS.DRONES.RESTRICTIONS' +
    '&STYLE=normal&FORMAT=image/png' +
    '&TILEMATRIXSET=PM_3_15' +
    '&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
const DRONE_RESTRICTIONS_WFS_URL = 'https://data.geopf.fr/wfs/ows';
const DRONE_RESTRICTIONS_TYPE_NAME =
    'TRANSPORTS.DRONES.RESTRICTIONS:carte_restriction_drones_lf';
const DRONE_RESTRICTIONS_ATTRIBUTION =
    '&copy; <a href="https://cartes.gouv.fr/">IGN GeoPlateforme</a> / DGAC';
const DRONE_RESTRICTIONS_BOUNDS = [
    [-44.6281, -63.7846],
    [51.2159, 67.5485],
];
const DRONE_RESTRICTIONS_MAX_FEATURES = 100;
const DRONE_RESTRICTIONS_IDENTIFY_BUFFER = 0.003;

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
        color: 'rgb(255, 159, 159)',
        weight: 3,
        opacity: 0.8,
        fillOpacity: 0.25,
    },
    highlight: {
        color: 'rgb(255, 159, 159)',
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
 * @param {Object} [options]
 * @returns {L.TileLayer}
 */
function createDroneRestrictionsLayer(options = {}) {
    return L.tileLayer(options.tileUrl || DRONE_RESTRICTIONS_TILE_URL, {
        attribution: options.attribution || DRONE_RESTRICTIONS_ATTRIBUTION,
        bounds: options.bounds || DRONE_RESTRICTIONS_BOUNDS,
        crossOrigin: true,
        maxNativeZoom: options.maxNativeZoom || 15,
        maxZoom: options.maxZoom || 22,
        minNativeZoom: options.minNativeZoom || 3,
        noWrap: true,
        opacity: options.opacity ?? 0.55,
        zIndex: options.zIndex || 300,
    });
}

/**
 * @param {L.Map} map
 * @param {Object} [options]
 * @returns {{layer: L.TileLayer, control: L.Control.Layers}|null}
 */
function addDroneRestrictionsControl(map, options = {}) {
    if (!map || !options.enabled) {
        return null;
    }

    const layer = createDroneRestrictionsLayer(options);
    const label = options.label || 'Drone restrictions';
    const control = L.control.layers({}, {
        [label]: layer,
    }, {
        collapsed: options.collapsed !== false,
        position: options.position || 'topright',
    });

    control.addTo(map);

    if (options.defaultOn) {
        layer.addTo(map);
    }

    if (options.identifyOnClick !== false) {
        addDroneRestrictionsIdentifyHandler(map, layer, options);
    }

    return {layer, control};
}

/**
 * @param {L.Map} map
 * @param {L.TileLayer} layer
 * @param {Object} [options]
 */
function addDroneRestrictionsIdentifyHandler(map, layer, options = {}) {
    let requestId = 0;

    map.on('click', (event) => {
        if (!map.hasLayer(layer)) {
            return;
        }

        const currentRequestId = ++requestId;
        const popup = L.popup()
            .setLatLng(event.latlng)
            .setContent(
                '<div class="geo-spatial-drone-popup">' +
                '<strong>Drone restrictions</strong><br>Checking...' +
                '</div>'
            )
            .openOn(map);

        fetchDroneRestrictionsAtLatLng(event.latlng, options)
            .then((restrictions) => {
                if (currentRequestId !== requestId) {
                    return;
                }

                popup.setContent(formatDroneRestrictionPopup(restrictions));
            })
            .catch(() => {
                if (currentRequestId !== requestId) {
                    return;
                }

                popup.setContent(
                    '<div class="geo-spatial-drone-popup">' +
                    '<strong>Drone restrictions</strong><br>' +
                    'Could not load restriction details.' +
                    '</div>'
                );
            });
    });
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
 * @returns {boolean}
 */
function hasAreaGeometry(geojson) {
    return collectPolygons(geojson).length > 0;
}

/**
 * @param {Object} geojson
 * @param {Object} [options]
 * @returns {Promise<Object[]>}
 */
function fetchDroneRestrictionOverlaps(geojson, options = {}) {
    if (!hasAreaGeometry(geojson)) {
        return Promise.resolve([]);
    }

    const bbox = getGeoJsonBbox(geojson);

    if (!bbox) {
        return Promise.resolve([]);
    }

    const maxFeatures = options.maxFeatures || DRONE_RESTRICTIONS_MAX_FEATURES;
    const params = new URLSearchParams({
        SERVICE: 'WFS',
        VERSION: '2.0.0',
        REQUEST: 'GetFeature',
        TYPENAMES: options.typeName || DRONE_RESTRICTIONS_TYPE_NAME,
        OUTPUTFORMAT: 'application/json',
        SRSNAME: 'EPSG:4326',
        COUNT: String(maxFeatures),
        BBOX: bbox.join(',') + ',EPSG:4326',
    });

    return fetch((options.wfsUrl || DRONE_RESTRICTIONS_WFS_URL) + '?' + params)
        .then((response) => {
            if (!response.ok) {
                throw new Error('Drone restriction lookup failed.');
            }

            return response.json();
        })
        .then((featureCollection) => {
            const features = featureCollection.features || [];
            const matches = [];
            const seen = new Set();

            features.forEach((feature) => {
                if (!geoJsonIntersects(geojson, feature)) {
                    return;
                }

                const summary = toDroneRestrictionSummary(feature);
                const key = summary.id || JSON.stringify(summary);

                if (seen.has(key)) {
                    return;
                }

                seen.add(key);
                matches.push(summary);
            });

            return matches;
        });
}

/**
 * @param {L.LatLng|Object} latlng
 * @param {Object} [options]
 * @returns {Promise<Object[]>}
 */
function fetchDroneRestrictionsAtLatLng(latlng, options = {}) {
    const lng = Number(latlng.lng);
    const lat = Number(latlng.lat);

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        return Promise.resolve([]);
    }

    const buffer = options.identifyBuffer ||
        DRONE_RESTRICTIONS_IDENTIFY_BUFFER;
    const bbox = [
        lng - buffer,
        lat - buffer,
        lng + buffer,
        lat + buffer,
    ];
    const maxFeatures = options.maxFeatures || DRONE_RESTRICTIONS_MAX_FEATURES;
    const params = new URLSearchParams({
        SERVICE: 'WFS',
        VERSION: '2.0.0',
        REQUEST: 'GetFeature',
        TYPENAMES: options.typeName || DRONE_RESTRICTIONS_TYPE_NAME,
        OUTPUTFORMAT: 'application/json',
        SRSNAME: 'EPSG:4326',
        COUNT: String(maxFeatures),
        BBOX: bbox.join(',') + ',EPSG:4326',
    });
    const point = [lng, lat];

    return fetch((options.wfsUrl || DRONE_RESTRICTIONS_WFS_URL) + '?' + params)
        .then((response) => {
            if (!response.ok) {
                throw new Error('Drone restriction identify failed.');
            }

            return response.json();
        })
        .then((featureCollection) => {
            const features = featureCollection.features || [];
            const matches = [];
            const seen = new Set();

            features.forEach((feature) => {
                if (!geoJsonContainsPoint(feature, point)) {
                    return;
                }

                const summary = toDroneRestrictionSummary(feature);
                const key = summary.id || JSON.stringify(summary);

                if (seen.has(key)) {
                    return;
                }

                seen.add(key);
                matches.push(summary);
            });

            return matches;
        });
}

/**
 * @param {Object} geojson
 * @returns {number[]|null}
 */
function getGeoJsonBbox(geojson) {
    const bbox = [Infinity, Infinity, -Infinity, -Infinity];

    walkCoordinates(geojson, (point) => {
        const lng = Number(point[0]);
        const lat = Number(point[1]);

        if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
            return;
        }

        bbox[0] = Math.min(bbox[0], lng);
        bbox[1] = Math.min(bbox[1], lat);
        bbox[2] = Math.max(bbox[2], lng);
        bbox[3] = Math.max(bbox[3], lat);
    });

    if (!Number.isFinite(bbox[0])) {
        return null;
    }

    return bbox;
}

/**
 * @param {Object|Array} value
 * @param {Function} callback
 */
function walkCoordinates(value, callback) {
    if (!value) {
        return;
    }

    if (Array.isArray(value)) {
        if (
            value.length >= 2 &&
            typeof value[0] === 'number' &&
            typeof value[1] === 'number'
        ) {
            callback(value);

            return;
        }

        value.forEach((item) => walkCoordinates(item, callback));

        return;
    }

    if (value.type === 'FeatureCollection') {
        (value.features || []).forEach((feature) => {
            walkCoordinates(feature, callback);
        });

        return;
    }

    if (value.type === 'Feature') {
        walkCoordinates(value.geometry, callback);

        return;
    }

    if (value.type === 'GeometryCollection') {
        (value.geometries || []).forEach((geometry) => {
            walkCoordinates(geometry, callback);
        });

        return;
    }

    walkCoordinates(value.coordinates, callback);
}

/**
 * @param {Object} geojson
 * @returns {Array[]}
 */
function collectPolygons(geojson) {
    const polygons = [];

    collectPolygonsFromValue(geojson, polygons);

    return polygons;
}

/**
 * @param {Object} value
 * @param {Array[]} polygons
 */
function collectPolygonsFromValue(value, polygons) {
    if (!value) {
        return;
    }

    if (value.type === 'FeatureCollection') {
        (value.features || []).forEach((feature) => {
            collectPolygonsFromValue(feature, polygons);
        });

        return;
    }

    if (value.type === 'Feature') {
        collectPolygonsFromValue(value.geometry, polygons);

        return;
    }

    if (value.type === 'Polygon') {
        if (Array.isArray(value.coordinates?.[0])) {
            polygons.push(value.coordinates);
        }

        return;
    }

    if (value.type === 'MultiPolygon') {
        (value.coordinates || []).forEach((polygon) => {
            if (Array.isArray(polygon?.[0])) {
                polygons.push(polygon);
            }
        });

        return;
    }

    if (value.type === 'GeometryCollection') {
        (value.geometries || []).forEach((geometry) => {
            collectPolygonsFromValue(geometry, polygons);
        });
    }
}

/**
 * @param {Object} a
 * @param {Object} b
 * @returns {boolean}
 */
function geoJsonIntersects(a, b) {
    const aPolygons = collectPolygons(a);
    const bPolygons = collectPolygons(b);

    return aPolygons.some((aPolygon) => {
        return bPolygons.some((bPolygon) => {
            return polygonsIntersect(aPolygon, bPolygon);
        });
    });
}

/**
 * @param {Object} geojson
 * @param {number[]} point
 * @returns {boolean}
 */
function geoJsonContainsPoint(geojson, point) {
    return collectPolygons(geojson).some((polygon) => {
        return pointInPolygon(point, polygon);
    });
}

/**
 * @param {Array[]} a
 * @param {Array[]} b
 * @returns {boolean}
 */
function polygonsIntersect(a, b) {
    if (!ringsHaveBboxOverlap(a, b)) {
        return false;
    }

    const aExterior = a[0] || [];
    const bExterior = b[0] || [];

    if (aExterior.some((point) => pointInPolygon(point, b))) {
        return true;
    }

    if (bExterior.some((point) => pointInPolygon(point, a))) {
        return true;
    }

    return polygonSegments(a).some((aSegment) => {
        return polygonSegments(b).some((bSegment) => {
            return segmentsIntersect(
                aSegment[0], aSegment[1], bSegment[0], bSegment[1]
            );
        });
    });
}

/**
 * @param {Array[]} a
 * @param {Array[]} b
 * @returns {boolean}
 */
function ringsHaveBboxOverlap(a, b) {
    const aBbox = ringBbox(a[0] || []);
    const bBbox = ringBbox(b[0] || []);

    if (!aBbox || !bBbox) {
        return false;
    }

    return !(
        aBbox[2] < bBbox[0] ||
        aBbox[0] > bBbox[2] ||
        aBbox[3] < bBbox[1] ||
        aBbox[1] > bBbox[3]
    );
}

/**
 * @param {Array[]} ring
 * @returns {number[]|null}
 */
function ringBbox(ring) {
    if (!Array.isArray(ring) || ring.length === 0) {
        return null;
    }

    return ring.reduce((bbox, point) => {
        bbox[0] = Math.min(bbox[0], point[0]);
        bbox[1] = Math.min(bbox[1], point[1]);
        bbox[2] = Math.max(bbox[2], point[0]);
        bbox[3] = Math.max(bbox[3], point[1]);

        return bbox;
    }, [Infinity, Infinity, -Infinity, -Infinity]);
}

/**
 * @param {Array[]} polygon
 * @returns {Array[]}
 */
function polygonSegments(polygon) {
    const segments = [];

    polygon.forEach((ring) => {
        for (let i = 0; i < ring.length - 1; i++) {
            segments.push([ring[i], ring[i + 1]]);
        }
    });

    return segments;
}

/**
 * @param {number[]} point
 * @param {Array[]} polygon
 * @returns {boolean}
 */
function pointInPolygon(point, polygon) {
    if (!pointInRing(point, polygon[0] || [])) {
        return false;
    }

    for (let i = 1; i < polygon.length; i++) {
        if (pointInRing(point, polygon[i])) {
            return false;
        }
    }

    return true;
}

/**
 * @param {number[]} point
 * @param {Array[]} ring
 * @returns {boolean}
 */
function pointInRing(point, ring) {
    const x = point[0];
    const y = point[1];
    let inside = false;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0];
        const yi = ring[i][1];
        const xj = ring[j][0];
        const yj = ring[j][1];

        if (pointOnSegment(point, ring[i], ring[j])) {
            return true;
        }

        const intersects = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

        if (intersects) {
            inside = !inside;
        }
    }

    return inside;
}

/**
 * @param {number[]} a
 * @param {number[]} b
 * @param {number[]} c
 * @param {number[]} d
 * @returns {boolean}
 */
function segmentsIntersect(a, b, c, d) {
    const o1 = orientation(a, b, c);
    const o2 = orientation(a, b, d);
    const o3 = orientation(c, d, a);
    const o4 = orientation(c, d, b);

    if (o1 !== o2 && o3 !== o4) {
        return true;
    }

    return (
        (o1 === 0 && pointOnSegment(c, a, b)) ||
        (o2 === 0 && pointOnSegment(d, a, b)) ||
        (o3 === 0 && pointOnSegment(a, c, d)) ||
        (o4 === 0 && pointOnSegment(b, c, d))
    );
}

/**
 * @param {number[]} a
 * @param {number[]} b
 * @param {number[]} c
 * @returns {number}
 */
function orientation(a, b, c) {
    const value = (b[1] - a[1]) * (c[0] - b[0]) -
        (b[0] - a[0]) * (c[1] - b[1]);

    if (Math.abs(value) < 1e-12) {
        return 0;
    }

    return value > 0 ? 1 : 2;
}

/**
 * @param {number[]} point
 * @param {number[]} a
 * @param {number[]} b
 * @returns {boolean}
 */
function pointOnSegment(point, a, b) {
    const cross = (point[1] - a[1]) * (b[0] - a[0]) -
        (point[0] - a[0]) * (b[1] - a[1]);

    if (Math.abs(cross) > 1e-12) {
        return false;
    }

    return (
        point[0] <= Math.max(a[0], b[0]) + 1e-12 &&
        point[0] >= Math.min(a[0], b[0]) - 1e-12 &&
        point[1] <= Math.max(a[1], b[1]) + 1e-12 &&
        point[1] >= Math.min(a[1], b[1]) - 1e-12
    );
}

/**
 * @param {Object} feature
 * @returns {Object}
 */
function toDroneRestrictionSummary(feature) {
    const properties = feature.properties || {};
    const result = {
        id: feature.id || properties.id || null,
    };

    if (properties.limite !== undefined && properties.limite !== null) {
        result.limite = properties.limite;
    }

    if (properties.remarque !== undefined && properties.remarque !== null) {
        result.remarque = properties.remarque;
    }

    return result;
}

/**
 * @param {Object[]} restrictions
 * @returns {string}
 */
function formatDroneRestrictionPopup(restrictions) {
    if (!restrictions.length) {
        return '<div class="geo-spatial-drone-popup">' +
            '<strong>Drone restrictions</strong><br>' +
            'No restriction found at this point.' +
            '</div>';
    }

    const items = restrictions.map((restriction) => {
        const details = [];

        if (restriction.limite) {
            details.push(
                '<div><strong>Limit:</strong> ' +
                escapeHtml(restriction.limite) +
                '</div>'
            );
        }

        if (restriction.remarque) {
            details.push(
                '<div><strong>Note:</strong> ' +
                escapeHtml(restriction.remarque) +
                '</div>'
            );
        }

        if (!details.length) {
            details.push('<div>No details provided.</div>');
        }

        return '<li>' + details.join('') + '</li>';
    });

    return '<div class="geo-spatial-drone-popup">' +
        '<strong>Drone restrictions</strong>' +
        '<ul>' + items.join('') + '</ul>' +
        '</div>';
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value;

    return div.innerHTML;
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
    createDroneRestrictionsLayer,
    addDroneRestrictionsControl,
    addGeoJsonLayer,
    fitToLayer,
    createDrawControl,
    extractGeoJson,
    hasAreaGeometry,
    fetchDroneRestrictionOverlaps,
    fetchDroneRestrictionsAtLatLng,
    getGeometryTypeLabel,
    getGeometryIcon,
    GEOMETRY_STYLES,
};

export default {
    createMap,
    createDroneRestrictionsLayer,
    addDroneRestrictionsControl,
    addGeoJsonLayer,
    fitToLayer,
    createDrawControl,
    extractGeoJson,
    hasAreaGeometry,
    fetchDroneRestrictionOverlaps,
    fetchDroneRestrictionsAtLatLng,
    getGeometryTypeLabel,
    getGeometryIcon,
    GEOMETRY_STYLES,
};
