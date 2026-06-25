<?php

namespace Vizuall\ColumnBuilder\Fieldtypes;

use Statamic\Fieldtypes\Replicator;

class ColumnBuilder extends Replicator
{
    protected static $handle = 'column_builder';
    protected $selectable = true;

    public function component(): string
    {
        return 'column-builder';
    }

    public function preload(): array
    {
        $this->injectWidthsField();

        $existing = collect($this->field->value())->mapWithKeys(function ($set, $index) {
            try {
                return [$set['_id'] => $this->fields($set['type'], $index)->addValues($set)->meta()->put('_', '_')];
            } catch (\Throwable $e) {
                return [$set['_id'] => collect(['_' => '_'])];
            }
        })->toArray();

        $blink = md5(json_encode($this->flattenedSetsConfig()));

        $defaults = \Statamic\Facades\Blink::once($blink.'-cb-defaults', function () {
            return collect($this->flattenedSetsConfig())->map(function ($set, $handle) {
                try {
                    return $this->fields($handle)->all()->map(function ($field) {
                        return $field->fieldtype()->preProcess($field->defaultValue());
                    })->all();
                } catch (\Throwable $e) {
                    return [];
                }
            })->all();
        });

        $new = \Statamic\Facades\Blink::once($blink.'-cb-new', function () use ($defaults) {
            return collect($this->flattenedSetsConfig())->map(function ($set, $handle) use ($defaults) {
                // Per-felt try-catch: Bard og assets kan smide fejl uden at tage andre felter med sig
                try {
                    $fields = $this->fields($handle)->addValues($defaults[$handle] ?? []);
                } catch (\Throwable $e) {
                    return collect(['_' => '_']);
                }

                $meta = collect(['_' => '_']);
                foreach ($fields->all() as $field) {
                    try {
                        $meta->put($field->handle(), $field->fieldtype()->preload());
                    } catch (\Throwable $e) {
                        // Feltet får ingen meta — fieldtypen bruger sine defaults
                    }
                }
                return $meta;
            })->toArray();
        });

        // Resolved field configs for popup rendering (col_w_* filtered out)
        $setsConfig = collect($this->flattenedSetsConfig())->map(function ($set, $handle) {
            try {
                return [
                    'display' => $set['display'] ?? $handle,
                    'fields'  => $this->fields($handle)->all()
                        ->filter(fn ($field) => ! str_starts_with($field->handle(), 'col_w'))
                        ->map(fn ($field) => [
                            'handle'  => $field->handle(),
                            'display' => $field->display(),
                            'config'  => $field->config(),
                        ])
                        ->values()
                        ->all(),
                ];
            } catch (\Throwable $e) {
                return ['display' => $handle, 'fields' => []];
            }
        })->all();

        return [
            'existing'    => $existing,
            'new'         => $new,
            'defaults'    => $defaults,
            'collapsed'   => $this->config('collapse') ? array_keys($existing) : [],
            'breakpoints' => [
                ['handle' => 'mobile',  'label' => 'Mobil'],
                ['handle' => 'tablet',  'label' => 'Tablet'],
                ['handle' => 'desktop', 'label' => 'Desktop'],
            ],
            'sets_config' => $setsConfig,
        ];
    }

    protected function injectWidthsField(): void
    {
        $config = $this->field->config();
        $sets   = $config['sets'] ?? [];

        // Three separate text fields — avoids group/integer meta-generation issues
        $widthFields = [
            ['handle' => 'col_w_m', 'field' => ['type' => 'text', 'display' => 'W Mobil',   'default' => '12']],
            ['handle' => 'col_w_t', 'field' => ['type' => 'text', 'display' => 'W Tablet',  'default' => '6']],
            ['handle' => 'col_w_d', 'field' => ['type' => 'text', 'display' => 'W Desktop', 'default' => '4']],
            ['handle' => 'col_color', 'field' => ['type' => 'color_scheme_selector', 'display' => 'Baggrundsfarve']],
        ];

        foreach ($sets as &$group) {
            foreach (($group['sets'] ?? []) as &$set) {
                $handles = array_column($set['fields'] ?? [], 'handle');
                foreach ($widthFields as $wf) {
                    if (! in_array($wf['handle'], $handles)) {
                        $set['fields'][] = $wf;
                    }
                }
            }
        }

        $this->field->setConfig(array_merge($config, ['sets' => $sets]));
    }
}
