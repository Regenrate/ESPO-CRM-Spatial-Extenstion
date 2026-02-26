<?php

namespace Espo\Modules\GeoSpatial\Classes\FieldValidators;

use Espo\ORM\Entity;

class GeometryType
{
    private const VALID_GEOMETRY_TYPES = [
        'Point',
        'LineString',
        'Polygon',
        'MultiPoint',
        'MultiLineString',
        'MultiPolygon',
        'GeometryCollection',
    ];

    private const VALID_GEOJSON_TYPES = [
        'Feature',
        'FeatureCollection',
        'Point',
        'LineString',
        'Polygon',
        'MultiPoint',
        'MultiLineString',
        'MultiPolygon',
        'GeometryCollection',
    ];

    /**
     * Returns true if non-empty, false if empty.
     */
    public function checkRequired(Entity $entity, string $field): bool
    {
        $value = $entity->get($field);

        return $value !== null && $value !== '';
    }

    /**
     * Returns true if the stored GeoJSON is structurally valid, false otherwise.
     * Empty values are considered valid (use 'required' for non-null enforcement).
     */
    public function checkValid(Entity $entity, string $field): bool
    {
        $value = $entity->get($field);

        if ($value === null || $value === '') {
            return true;
        }

        $decoded = json_decode($value, true);

        if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
            return false;
        }

        if (!is_array($decoded) || !isset($decoded['type'])) {
            return false;
        }

        if (!in_array($decoded['type'], self::VALID_GEOJSON_TYPES, true)) {
            return false;
        }

        if ($decoded['type'] === 'Feature') {
            return $this->validateFeature($decoded);
        }

        if ($decoded['type'] === 'FeatureCollection') {
            return $this->validateFeatureCollection($decoded);
        }

        return $this->validateGeometry($decoded);
    }

    private function validateFeature(array $feature): bool
    {
        if (!isset($feature['geometry']) || !is_array($feature['geometry'])) {
            return false;
        }

        return $this->validateGeometry($feature['geometry']);
    }

    private function validateFeatureCollection(array $collection): bool
    {
        if (!isset($collection['features']) || !is_array($collection['features'])) {
            return false;
        }

        foreach ($collection['features'] as $feature) {
            if (!is_array($feature)) {
                return false;
            }

            if (($feature['type'] ?? null) !== 'Feature') {
                return false;
            }

            if (!$this->validateFeature($feature)) {
                return false;
            }
        }

        return true;
    }

    private function validateGeometry(array $geometry): bool
    {
        $type = $geometry['type'] ?? null;

        if (!in_array($type, self::VALID_GEOMETRY_TYPES, true)) {
            return false;
        }

        if ($type === 'GeometryCollection') {
            return $this->validateGeometryCollection($geometry);
        }

        if (!isset($geometry['coordinates']) || !is_array($geometry['coordinates'])) {
            return false;
        }

        return match ($type) {
            'Point' => $this->validatePoint($geometry['coordinates']),
            'LineString' => $this->validateLineString($geometry['coordinates']),
            'Polygon' => $this->validatePolygon($geometry['coordinates']),
            'MultiPoint' => $this->validateMultiPoint($geometry['coordinates']),
            'MultiLineString' => $this->validateMultiLineString($geometry['coordinates']),
            'MultiPolygon' => $this->validateMultiPolygon($geometry['coordinates']),
            default => false,
        };
    }

    private function validateGeometryCollection(array $geometry): bool
    {
        if (!isset($geometry['geometries']) || !is_array($geometry['geometries'])) {
            return false;
        }

        foreach ($geometry['geometries'] as $geom) {
            if (!is_array($geom) || !$this->validateGeometry($geom)) {
                return false;
            }
        }

        return true;
    }

    private function validatePoint(array $coords): bool
    {
        if (count($coords) < 2) {
            return false;
        }

        return is_numeric($coords[0]) && is_numeric($coords[1]);
    }

    private function validateLineString(array $coords): bool
    {
        if (count($coords) < 2) {
            return false;
        }

        foreach ($coords as $point) {
            if (!is_array($point) || !$this->validatePoint($point)) {
                return false;
            }
        }

        return true;
    }

    private function validatePolygon(array $coords): bool
    {
        if (count($coords) < 1) {
            return false;
        }

        foreach ($coords as $ring) {
            if (!is_array($ring) || count($ring) < 4) {
                return false;
            }

            foreach ($ring as $point) {
                if (!is_array($point) || !$this->validatePoint($point)) {
                    return false;
                }
            }
        }

        return true;
    }

    private function validateMultiPoint(array $coords): bool
    {
        foreach ($coords as $point) {
            if (!is_array($point) || !$this->validatePoint($point)) {
                return false;
            }
        }

        return true;
    }

    private function validateMultiLineString(array $coords): bool
    {
        foreach ($coords as $line) {
            if (!is_array($line) || !$this->validateLineString($line)) {
                return false;
            }
        }

        return true;
    }

    private function validateMultiPolygon(array $coords): bool
    {
        foreach ($coords as $polygon) {
            if (!is_array($polygon) || !$this->validatePolygon($polygon)) {
                return false;
            }
        }

        return true;
    }
}
