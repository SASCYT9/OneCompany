<?php
/**
 * OneCompany Theme Customizer
 *
 * @package OneCompany
 */

function onecompany_customize_register( $wp_customize ) {
    // --- 1. Hero Section Panel ---
    $wp_customize->add_section( 'onecompany_hero_section', [
        'title'      => __( 'Hero Section', 'onecompany' ),
        'priority'   => 30,
    ] );

    // Hero Title
    $wp_customize->add_setting( 'onecompany_hero_title', [
        'default'           => 'onecompany',
        'sanitize_callback' => 'sanitize_text_field',
        'transport'         => 'postMessage',
    ] );
    $wp_customize->add_control( 'onecompany_hero_title_control', [
        'label'    => __( 'Hero Title', 'onecompany' ),
        'section'  => 'onecompany_hero_section',
        'settings' => 'onecompany_hero_title',
        'type'     => 'text',
    ] );

    // Hero Subtitle
    $wp_customize->add_setting( 'onecompany_hero_subtitle', [
        'default'           => __( 'Преміум автотюнінг. Три напрями. Одна філософія.', 'onecompany' ),
        'sanitize_callback' => 'sanitize_text_field',
        'transport'         => 'postMessage',
    ] );
    $wp_customize->add_control( 'onecompany_hero_subtitle_control', [
        'label'    => __( 'Hero Subtitle', 'onecompany' ),
        'section'  => 'onecompany_hero_section',
        'settings' => 'onecompany_hero_subtitle',
        'type'     => 'textarea',
    ] );

    // Hero Video
    $wp_customize->add_setting( 'onecompany_hero_video', [
        'default'           => '',
        'sanitize_callback' => 'esc_url_raw',
        'transport'         => 'refresh',
    ] );
    $wp_customize->add_control( new WP_Customize_Media_Control( $wp_customize, 'onecompany_hero_video_control', [
        'label'     => __( 'Background Video', 'onecompany' ),
        'section'   => 'onecompany_hero_section',
        'settings'  => 'onecompany_hero_video',
        'mime_type' => 'video',
    ] ) );

    // --- 2. Theme Colors Panel ---
    // Using the existing 'colors' section
    $wp_customize->add_setting( 'onecompany_accent_color', [
        'default'           => '#FF6B00',
        'sanitize_callback' => 'sanitize_hex_color',
        'transport'         => 'refresh',
    ] );
    $wp_customize->add_control( new WP_Customize_Color_Control( $wp_customize, 'onecompany_accent_color_control', [
        'label'    => __( 'Accent Color', 'onecompany' ),
        'section'  => 'colors',
        'settings' => 'onecompany_accent_color',
    ] ) );
}
add_action( 'customize_register', 'onecompany_customize_register' );

/**
 * Binds JS handlers to make Theme Customizer preview reload changes asynchronously.
 */
function onecompany_customize_preview_js() {
    wp_enqueue_script( 'onecompany-customizer', get_template_directory_uri() . '/js/customizer.js', [ 'customize-preview' ], '1.0', true );
}
add_action( 'customize_preview_init', 'onecompany_customize_preview_js' );

/**
 * Generates and applies custom CSS from the Customizer.
 */
function onecompany_customizer_css() {
    $accent_color = get_theme_mod( 'onecompany_accent_color', '#FF6B00' );
    
    if ( empty( $accent_color ) || $accent_color === '#FF6B00' ) {
        return;
    }
    
    $custom_css = "
        :root {
            --brand-primary: {$accent_color};
        }
    ";
    
    wp_add_inline_style( 'onecompany-style', $custom_css );
}
add_action( 'wp_enqueue_scripts', 'onecompany_customizer_css' );
