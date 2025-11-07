<?php
if (!defined('ABSPATH')) {
    exit;
}

function onecompany_register_tabs_block() {
    register_block_type('onecompany/tabs', array(
        'api_version' => 2,
        'title' => __('Tabs', 'onecompany'),
        'category' => 'onecompany-blocks',
        'icon' => 'index-card',
        'editor_script' => 'onecompany-tabs-block-editor',
        'editor_style'  => 'onecompany-tabs-block-editor',
        'style'         => 'onecompany-tabs-block',
    ));
}
add_action('init', 'onecompany_register_tabs_block');

function onecompany_tabs_block_assets() {
    wp_register_script(
        'onecompany-tabs-block-editor',
        plugins_url('tabs-editor.js', __FILE__),
        array('wp-blocks', 'wp-element', 'wp-editor', 'wp-components'),
        filemtime(plugin_dir_path(__FILE__) . 'tabs-editor.js')
    );

    wp_register_script(
        'onecompany-tabs-block',
        plugins_url('tabs.js', __FILE__),
        array(),
        filemtime(plugin_dir_path(__FILE__) . 'tabs.js'),
        true
    );

    wp_register_style(
        'onecompany-tabs-block-editor',
        plugins_url('tabs-editor.css', __FILE__),
        array('wp-edit-blocks'),
        filemtime(plugin_dir_path(__FILE__) . 'tabs-editor.css')
    );

    wp_register_style(
        'onecompany-tabs-block',
        plugins_url('tabs.css', __FILE__),
        array(),
        filemtime(plugin_dir_path(__FILE__) . 'tabs.css')
    );
}
add_action('init', 'onecompany_tabs_block_assets');
