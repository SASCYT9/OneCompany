<?php
/**
 * Plugin Name:       OneCompany Custom Blocks
 * Description:       A collection of custom Gutenberg blocks for the OneCompany theme.
 * Requires at least: 6.1
 * Requires PHP:      7.0
 * Version:           1.0.0
 * Author:            Jules
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       onecompany-custom-blocks
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

/**
 * Register all the custom blocks.
 */
function onecompany_custom_blocks_register_blocks() {
    $block_folders = [
        'accordion',
        'image-compare',
        'tabs',
        'call-to-action',
        'testimonials',
    ];

    foreach ( $block_folders as $block_folder ) {
        $block_path = plugin_dir_path( __FILE__ ) . 'blocks/' . $block_folder . '.php';
        if ( file_exists( $block_path ) ) {
            require_once $block_path;
        }
    }
}
add_action( 'init', 'onecompany_custom_blocks_register_blocks' );
