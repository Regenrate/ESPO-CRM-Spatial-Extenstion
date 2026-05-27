import BaseFieldView from 'views/fields/base';
import Ajax from 'ajax';

const PAGE_SIZE = 200;

export default class GeoDataDownloadFieldView extends BaseFieldView {

    listTemplateContent = `
        <span class="geo-spatial-geometry-badge">
            <span class="fas fa-download"></span> {{buttonLabel}}
        </span>
    `

    detailTemplateContent = `
        <div class="geo-spatial-download-actions">
            <button type="button"
                    class="btn btn-default geo-spatial-download-kml">
                <span class="fas fa-download"></span>
                <span>{{buttonLabel}}</span>
            </button>
            <span class="geo-spatial-download-status text-muted"></span>
        </div>
    `

    editTemplateContent = this.detailTemplateContent

    data() {
        const data = super.data();

        data.buttonLabel = this._getButtonLabel();

        return data;
    }

    setup() {
        super.setup();

        this._link = this.params.link || this._getFieldParam('link') || null;
        this._geometryField =
            this.params.geometryField ||
            this._getFieldParam('geometryField') ||
            null;
    }

    afterRender() {
        super.afterRender();

        if (this._isListMode()) {
            return;
        }

        const button = this.element?.querySelector('.geo-spatial-download-kml');

        if (!button) {
            return;
        }

        button.addEventListener('click', () => {
            this._downloadKml();
        });
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

    _getButtonLabel() {
        return this.params.buttonLabel ||
            this._getFieldParam('buttonLabel') ||
            this.translate('Download KML', 'labels', 'GeoSpatial') ||
            'Download KML';
    }

    async _downloadKml() {
        if (!this._link) {
            this._setStatus(
                this.translate('No download link configured', 'labels', 'GeoSpatial')
            );

            return;
        }

        if (!this._geometryField) {
            this._setStatus(
                this.translate('No geometry field configured', 'labels', 'GeoSpatial')
            );

            return;
        }

        const button = this.element?.querySelector('.geo-spatial-download-kml');

        this._setLoading(true);
        this._setStatus(this.translate('Preparing download...', 'labels', 'GeoSpatial'));

        try {
            const records = await this._fetchAllRelatedRecords();
            const features = this._extractFeatures(records);

            if (features.length === 0) {
                this._setStatus(
                    this.translate('No geometries found', 'labels', 'GeoSpatial')
                );

                return;
            }

            const kml = this._buildKml(features);
            const filename = this._buildFilename();

            this._triggerDownload(kml, filename);
            this._setStatus(this.translate('KML downloaded.', 'labels', 'GeoSpatial'));
        } catch (e) {
            this._setStatus(this.translate('Download failed.', 'labels', 'GeoSpatial'));
        } finally {
            this._setLoading(false);

            if (button) {
                button.focus();
            }
        }
    }

    async _fetchAllRelatedRecords() {
        const parentId = this.model.id;
        const parentType = this.model.entityType;

        if (!parentId || !parentType) {
            return [];
        }

        const records = [];
        let offset = 0;
        let total = null;

        do {
            const response = await Ajax.getRequest(
                `${parentType}/${parentId}/${this._link}`,
                {
                    select: ['id', 'name', this._geometryField].join(','),
                    maxSize: PAGE_SIZE,
                    offset: offset,
                    orderBy: 'createdAt',
                    order: 'desc',
                }
            );

            const page = response.list || [];

            records.push(...page);

            const responseTotal = Number(response.total);

            if (Number.isFinite(responseTotal)) {
                total = responseTotal;
            }

            offset += page.length;

            if (page.length === 0 || page.length < PAGE_SIZE) {
                break;
            }
        } while (total === null || offset < total);

        return records;
    }

    _extractFeatures(records) {
        const entityType = this._getRelatedEntityType();
        const features = [];

        records.forEach((record) => {
            const rawValue = record[this._geometryField];

            if (!rawValue) {
                return;
            }

            let geojson;

            try {
                geojson = typeof rawValue === 'string'
                    ? JSON.parse(rawValue)
                    : rawValue;
            } catch (e) {
                return;
            }

            this._featuresFromGeoJson(geojson).forEach((feature, index) => {
                feature.properties = feature.properties || {};
                feature.properties._recordId = record.id;
                feature.properties._recordName = record.name || record.id;
                feature.properties._recordEntityType = entityType;
                feature.properties._featureIndex = index + 1;

                features.push(feature);
            });
        });

        return features;
    }

    _featuresFromGeoJson(geojson) {
        if (!geojson || !geojson.type) {
            return [];
        }

        if (geojson.type === 'FeatureCollection') {
            return (geojson.features || [])
                .filter((feature) => feature && feature.type === 'Feature');
        }

        if (geojson.type === 'Feature') {
            return [geojson];
        }

        if (this._isGeometryType(geojson.type)) {
            return [{
                type: 'Feature',
                geometry: geojson,
                properties: {},
            }];
        }

        return [];
    }

    _buildKml(features) {
        const documentName = this._escapeXml(this._buildDocumentName());
        const placemarks = features
            .map((feature, index) => this._featureToPlacemark(feature, index))
            .filter(Boolean)
            .join('\n');

        return [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<kml xmlns="http://www.opengis.net/kml/2.2">',
            '<Document>',
            `<name>${documentName}</name>`,
            '<Style id="geo-spatial-polygon">',
            '<LineStyle><color>ff9f9fff</color><width>2</width></LineStyle>',
            '<PolyStyle><color>409f9fff</color></PolyStyle>',
            '</Style>',
            placemarks,
            '</Document>',
            '</kml>',
        ].join('\n');
    }

    _featureToPlacemark(feature, index) {
        const geometryKml = this._geometryToKml(feature.geometry);

        if (!geometryKml) {
            return null;
        }

        const props = feature.properties || {};
        const name = props._recordName || `Geometry ${index + 1}`;
        const placemarkName = this._escapeXml(name);
        const description = this._buildDescription(props);

        return [
            '<Placemark>',
            `<name>${placemarkName}</name>`,
            '<styleUrl>#geo-spatial-polygon</styleUrl>',
            description ? `<description><![CDATA[${description}]]></description>` : '',
            geometryKml,
            '</Placemark>',
        ].filter(Boolean).join('\n');
    }

    _geometryToKml(geometry) {
        if (!geometry || !geometry.type) {
            return '';
        }

        switch (geometry.type) {
            case 'Point':
                return `<Point><coordinates>${this._coordinate(geometry.coordinates)}</coordinates></Point>`;

            case 'LineString':
                return [
                    '<LineString><tessellate>1</tessellate>',
                    `<coordinates>${this._coordinates(geometry.coordinates)}</coordinates>`,
                    '</LineString>',
                ].join('');

            case 'Polygon':
                return this._polygonToKml(geometry.coordinates);

            case 'MultiPoint':
                return this._multiGeometry(
                    geometry.coordinates.map((point) => ({
                        type: 'Point',
                        coordinates: point,
                    }))
                );

            case 'MultiLineString':
                return this._multiGeometry(
                    geometry.coordinates.map((line) => ({
                        type: 'LineString',
                        coordinates: line,
                    }))
                );

            case 'MultiPolygon':
                return this._multiGeometry(
                    geometry.coordinates.map((polygon) => ({
                        type: 'Polygon',
                        coordinates: polygon,
                    }))
                );

            case 'GeometryCollection':
                return this._multiGeometry(geometry.geometries || []);

            default:
                return '';
        }
    }

    _polygonToKml(rings) {
        if (!Array.isArray(rings) || rings.length === 0) {
            return '';
        }

        const outer = rings[0];
        const inner = rings.slice(1);

        return [
            '<Polygon><tessellate>1</tessellate>',
            '<outerBoundaryIs><LinearRing>',
            `<coordinates>${this._coordinates(outer)}</coordinates>`,
            '</LinearRing></outerBoundaryIs>',
            inner.map((ring) => [
                '<innerBoundaryIs><LinearRing>',
                `<coordinates>${this._coordinates(ring)}</coordinates>`,
                '</LinearRing></innerBoundaryIs>',
            ].join('')).join(''),
            '</Polygon>',
        ].join('');
    }

    _multiGeometry(geometries) {
        const children = geometries
            .map((geometry) => this._geometryToKml(geometry))
            .filter(Boolean)
            .join('');

        return children ? `<MultiGeometry>${children}</MultiGeometry>` : '';
    }

    _coordinate(point) {
        if (!Array.isArray(point)) {
            return '';
        }

        return point.slice(0, 3).join(',');
    }

    _coordinates(points) {
        if (!Array.isArray(points)) {
            return '';
        }

        return points.map((point) => this._coordinate(point)).join(' ');
    }

    _buildDescription(props) {
        const entityType = props._recordEntityType;
        const id = props._recordId;

        if (!entityType || !id) {
            return '';
        }

        const href = this._recordUrl(entityType, id);

        return `<a href="${this._escapeHtmlAttribute(href)}">Open in EspoCRM</a>`;
    }

    _recordUrl(entityType, id) {
        const base = `${window.location.origin}${window.location.pathname}`;

        return `${base}#${entityType}/view/${id}`;
    }

    _buildDocumentName() {
        const entityType = this.model.entityType || this.model.name || 'Record';
        const name = this.model.get('name') || this.model.id || 'record';

        return `${entityType} ${name} parcels`;
    }

    _buildFilename() {
        const entityType = this._safeFilenamePart(
            this.model.entityType || this.model.name || 'Record'
        );
        const name = this.model.get('name');
        const id = this.model.id;
        const parts = [entityType];

        if (name) {
            parts.push(this._safeFilenamePart(name));
        }

        if (id) {
            parts.push(this._safeFilenamePart(id));
        }

        parts.push('parcels');

        return `${parts.filter(Boolean).join('-')}.kml`;
    }

    _safeFilenamePart(value) {
        return String(value)
            .trim()
            .replace(/[^a-zA-Z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 80) || 'record';
    }

    _triggerDownload(kml, filename) {
        const blob = new Blob([kml], {
            type: 'application/vnd.google-earth.kml+xml;charset=utf-8',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    _getRelatedEntityType() {
        const metadata = this.getMetadata();

        if (!metadata || !this._link) {
            return null;
        }

        const entityType = this.model.entityType || this.model.name;

        return metadata.get(
            ['entityDefs', entityType, 'links', this._link, 'entity']
        ) || null;
    }

    _isGeometryType(type) {
        const geomTypes = [
            'Point', 'LineString', 'Polygon',
            'MultiPoint', 'MultiLineString', 'MultiPolygon',
            'GeometryCollection',
        ];

        return geomTypes.includes(type);
    }

    _setStatus(message) {
        const statusEl = this.element?.querySelector(
            '.geo-spatial-download-status'
        );

        if (statusEl) {
            statusEl.textContent = message || '';
        }
    }

    _setLoading(isLoading) {
        const button = this.element?.querySelector('.geo-spatial-download-kml');

        if (button) {
            button.disabled = isLoading;
        }
    }

    _escapeXml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    _escapeHtmlAttribute(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    _isListMode() {
        return this.mode === 'list' || this.mode === 'listLink';
    }

    fetch() {
        return {};
    }
}
