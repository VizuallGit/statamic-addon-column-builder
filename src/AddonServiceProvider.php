<?php

namespace Vizuall\ColumnBuilder;

use Statamic\Providers\AddonServiceProvider as BaseAddonServiceProvider;

class AddonServiceProvider extends BaseAddonServiceProvider
{
    protected $fieldtypes = [
        Fieldtypes\ColumnBuilder::class,
    ];

    protected $scripts = [
        __DIR__.'/../resources/js/addon.js',
    ];
}
