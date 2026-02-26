<?php

use Espo\Core\Container;
use Espo\Core\DataManager;

class AfterInstall
{
    public function run(Container $container): void
    {
        $dataManager = $container->getByClass(DataManager::class);
        $dataManager->rebuild();
    }
}
