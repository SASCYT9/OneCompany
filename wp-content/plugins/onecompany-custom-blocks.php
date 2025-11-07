<?php
/**
 * Plugin Name: OneCompany Custom Blocks
 * Description: A collection of custom Gutenberg blocks for the OneCompany theme.
 * Version: 1.0.0
 * Author: OneCompany
 */

if (!defined('ABSPATH')) {
    exit;
}

// Include the accordion block registration
require_once __DIR__ . '/blocks/accordion.php';

// Include the tabs block registration
require_once __DIR__ . '/blocks/tabs.php';

// Include the image compare block registration
require_once __DIR__ . '/blocks/image-compare.php';
