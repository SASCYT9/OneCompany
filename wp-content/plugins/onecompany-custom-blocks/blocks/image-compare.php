<?php
if (!defined('ABSPATH')) {
    exit;
}

function onecompany_register_image_compare_block() {
    register_block_type('onecompany/image-compare', array(
        'api_version'   => 2,
        'title'         => __('Image Compare', 'onecompany'),
        'category'      => 'onecompany-blocks',
        'icon'          => 'image-flip-horizontal',
        'editor_script' => 'onecompany-image-compare-editor',
        'editor_style'  => 'onecompany-image-compare-editor',
        'style'         => 'onecompany-image-compare',
        'script'        => 'onecompany-image-compare-script',
    ));
}
add_action('init', 'onecompany_register_image_compare_block');

function onecompany_image_compare_assets() {
    wp_register_script(
        'onecompany-image-compare-editor',
        plugins_url('image-compare-editor.js', __FILE__),
        array('wp-blocks', 'wp-element', 'wp-editor', 'wp-components'),
        filemtime(plugin_dir_path(__FILE__) . 'image-compare-editor.js')
    );

    wp_register_style(
        'onecompany-image-compare-editor',
        plugins_url('image-compare-editor.css', __FILE__),
        array('wp-edit-blocks'),
        filemtime(plugin_dir_path(__FILE__) . 'image-compare-editor.css')
    );

    // BeerSlider library from CDN
    wp_register_script(
        'beerslider-js',
        'https://cdn.jsdelivr.net/npm/beerslider@1.1.0/dist/beerslider.min.js',
        array(),
        '1.1.0',
        true
    );

    wp_register_style(
        'beerslider-css',
        'https://cdn.jsdelivr.net/npm/beerslider@1.1.0/dist/beerslider.min.css',
        array(),
        '1.1.0'
    );

    // Frontend script to initialize the slider
    wp_register_script(
        'onecompany-image-compare-script',
        plugins_url('image-compare.js', __FILE__),
        array('beerslider-js'),
        filemtime(plugin_dir_path(__FILE__) . 'image-compare.js'),
        true
    );

    // Frontend styles
    wp_register_style(
        'onecompany-image-compare',
        plugins_url('image-compare.css', __FILE__),
        array('beerslider-css'),
        filemtime(plugin_dir_path(__FILE__) . 'image-compare.css')
    );
}
add_action('init', 'onecompany_image_compare_assets');
