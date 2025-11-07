<?php
if (!defined('ABSPATH')) {
    exit;
}

function onecompany_register_accordion_block() {
    register_block_type('onecompany/accordion', array(
        'api_version' => 2,
        'title' => __('Accordion', 'onecompany'),
        'category' => 'onecompany-blocks',
        'icon' => 'menu',
        'editor_script' => 'onecompany-accordion-block-editor',
        'editor_style'  => 'onecompany-accordion-block-editor',
        'style'         => 'onecompany-accordion-block',
    ));
}
add_action('init', 'onecompany_register_accordion_block');

function onecompany_accordion_block_assets() {
    // Register editor script
    wp_register_script(
        'onecompany-accordion-block-editor',
        plugins_url('accordion-editor.js', __FILE__),
        array('wp-blocks', 'wp-element', 'wp-editor', 'wp-components'),
        filemtime(plugin_dir_path(__FILE__) . 'accordion-editor.js')
    );

    // Register front-end script
    wp_register_script(
        'onecompany-accordion-block',
        plugins_url('accordion.js', __FILE__),
        array(),
        filemtime(plugin_dir_path(__FILE__) . 'accordion.js'),
        true
    );

    // Register editor style
    wp_register_style(
        'onecompany-accordion-block-editor',
        plugins_url('accordion-editor.css', __FILE__),
        array('wp-edit-blocks'),
        filemtime(plugin_dir_path(__FILE__) . 'accordion-editor.css')
    );

    // Register front-end style
    wp_register_style(
        'onecompany-accordion-block',
        plugins_url('accordion.css', __FILE__),
        array(),
        filemtime(plugin_dir_path(__FILE__) . 'accordion.css')
    );
}
add_action('init', 'onecompany_accordion_block_assets');
