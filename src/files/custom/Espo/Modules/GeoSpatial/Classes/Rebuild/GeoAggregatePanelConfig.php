<?php

namespace Espo\Modules\GeoSpatial\Classes\Rebuild;

use Espo\Core\Rebuild\RebuildAction;
use Espo\Core\Utils\Metadata;

use stdClass;

/**
 * Scans entity definitions for geometry fields and automatically registers
 * aggregation map panels on parent entities that have one-to-many or
 * many-to-many relationships to entities with geometry fields.
 */
class GeoAggregatePanelConfig implements RebuildAction
{
    private const PANEL_VIEW = 'modules/geo-spatial/views/record/panels/geo-aggregate-map';
    private const PANEL_PREFIX = 'geoAggregateMap_';

    public function __construct(
        private Metadata $metadata,
    ) {}

    public function process(): void
    {
        $entityDefsMap = $this->metadata->get(['entityDefs']) ?? [];
        $geometryEntityMap = $this->findEntitiesWithGeometryFields($entityDefsMap);

        if (empty($geometryEntityMap)) {
            return;
        }

        foreach ($entityDefsMap as $parentEntityType => $parentDefs) {
            $links = $parentDefs['links'] ?? [];

            foreach ($links as $linkName => $linkDef) {
                $relationType = $linkDef['type'] ?? null;
                $foreignEntity = $linkDef['entity'] ?? null;

                if (!$foreignEntity) {
                    continue;
                }

                if (!in_array($relationType, ['hasMany', 'hasChildren'], true)) {
                    continue;
                }

                if (!isset($geometryEntityMap[$foreignEntity])) {
                    continue;
                }

                $geometryConfig = $geometryEntityMap[$foreignEntity];
                $geometryFields = $geometryConfig['fields'];
                $panelName = self::PANEL_PREFIX . $linkName;

                $this->registerPanel(
                    $parentEntityType,
                    $panelName,
                    $linkName,
                    $geometryFields,
                    (bool) ($geometryConfig['droneRestrictionsEnabled'] ?? false),
                    (bool) ($geometryConfig['droneRestrictionsDefaultOn'] ?? false)
                );
            }
        }
    }

    /**
     * @param array<string, array<string, mixed>> $entityDefsMap
     * @return array<string, array<string, mixed>>
     */
    private function findEntitiesWithGeometryFields(array $entityDefsMap): array
    {
        $result = [];

        foreach ($entityDefsMap as $entityType => $defs) {
            $fields = $defs['fields'] ?? [];

            foreach ($fields as $fieldName => $fieldDef) {
                $fieldType = $fieldDef['type'] ?? null;

                if ($fieldType !== 'geometry') {
                    continue;
                }

                if (!isset($result[$entityType])) {
                    $result[$entityType] = [
                        'fields' => [],
                        'droneRestrictionsEnabled' => false,
                        'droneRestrictionsDefaultOn' => false,
                    ];
                }

                $result[$entityType]['fields'][] = $fieldName;

                if (($fieldDef['droneRestrictionsEnabled'] ?? false) === true) {
                    $result[$entityType]['droneRestrictionsEnabled'] = true;
                }

                if (($fieldDef['droneRestrictionsDefaultOn'] ?? false) === true) {
                    $result[$entityType]['droneRestrictionsDefaultOn'] = true;
                }
            }
        }

        return $result;
    }

    /**
     * @param string[] $geometryFields
     */
    private function registerPanel(
        string $parentEntityType,
        string $panelName,
        string $linkName,
        array $geometryFields,
        bool $droneRestrictionsEnabled,
        bool $droneRestrictionsDefaultOn
    ): void {
        $existing = $this->metadata->get(
            ['clientDefs', $parentEntityType, 'bottomPanels', 'detail']
        ) ?? [];

        $existingHasPanel = false;

        foreach ($existing as $panel) {
            if (is_array($panel) && ($panel['name'] ?? null) === $panelName) {
                $existingHasPanel = true;

                break;
            }
        }

        $panelDef = [
            'name' => $panelName,
            'label' => 'Map: ' . $linkName,
            'view' => self::PANEL_VIEW,
            'order' => 100,
            'options' => [
                'link' => $linkName,
                'geometryFields' => $geometryFields,
                'droneRestrictionsEnabled' => $droneRestrictionsEnabled,
                'droneRestrictionsDefaultOn' => $droneRestrictionsDefaultOn,
            ],
        ];

        $customData = $this->metadata->getCustom('clientDefs', $parentEntityType);

        $customArray = $customData !== null
            ? json_decode(json_encode($customData), true)
            : [];

        $bottomPanels = $customArray['bottomPanels']['detail'] ?? [];

        foreach ($bottomPanels as $i => $p) {
            if (is_array($p) && ($p['name'] ?? null) === $panelName) {
                $bottomPanels[$i] = array_merge($p, $panelDef);
                $customArray['bottomPanels'] = ['detail' => $bottomPanels];

                $this->metadata->saveCustom(
                    'clientDefs',
                    $parentEntityType,
                    (object) json_decode(json_encode($customArray))
                );

                return;
            }
        }

        if ($existingHasPanel) {
            return;
        }

        if (empty($bottomPanels)) {
            $bottomPanels = ['__APPEND__'];
        }

        $bottomPanels[] = $panelDef;

        $customArray['bottomPanels'] = ['detail' => $bottomPanels];

        $this->metadata->saveCustom(
            'clientDefs',
            $parentEntityType,
            (object) json_decode(json_encode($customArray))
        );
    }
}
