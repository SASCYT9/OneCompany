<?php
/**
 * OneCompany Premium Theme
 * functions.php
 */

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Load Customizer customizations.
 */
require get_template_directory() . '/inc/customizer.php';

// Theme Support
function onecompany_theme_support() {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('custom-logo');
    add_theme_support('html5', array('search-form', 'comment-form', 'comment-list', 'gallery', 'caption'));
}
add_action('after_setup_theme', 'onecompany_theme_support');

// Enqueue Scripts and Styles
function onecompany_enqueue_assets() {
    wp_enqueue_style('onecompany-style', get_stylesheet_uri(), array(), '3.0.0');
    wp_enqueue_style('google-fonts', 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap', array(), null);
    wp_enqueue_script('onecompany-main', get_template_directory_uri() . '/js/main.js', array(), '3.0.0', true);
}
add_action('wp_enqueue_scripts', 'onecompany_enqueue_assets');

// Register Custom Post Type: Brands
function onecompany_register_brands_post_type() {
    $labels = array(
        'name'               => 'Бренди',
        'singular_name'      => 'Бренд',
        'menu_name'          => 'Бренди',
        'add_new'            => 'Додати новий',
        'add_new_item'       => 'Додати новий бренд',
        'edit_item'          => 'Редагувати бренд',
        'new_item'           => 'Новий бренд',
        'view_item'          => 'Переглянути бренд',
        'search_items'       => 'Шукати бренди',
        'not_found'          => 'Брендів не знайдено',
        'not_found_in_trash' => 'У кошику брендів не знайдено'
    );

    $args = array(
        'labels'              => $labels,
        'public'              => true,
        'has_archive'         => true,
        'publicly_queryable'  => true,
        'show_ui'             => true,
        'show_in_menu'        => true,
        'query_var'           => true,
        'rewrite'             => array('slug' => 'brands'),
        'capability_type'     => 'post',
        'has_archive'         => true,
        'hierarchical'        => false,
        'menu_position'       => 5,
        'menu_icon'           => 'dashicons-awards',
        'supports'            => array('title', 'editor', 'thumbnail', 'custom-fields'),
        'show_in_rest'        => true
    );

    register_post_type('brand', $args);
}
add_action('init', 'onecompany_register_brands_post_type');

// Register Taxonomy for Brands: Brand Category
function onecompany_register_brand_category_taxonomy() {
    $labels = array(
        'name'              => 'Категорії Брендів',
        'singular_name'     => 'Категорія Бренду',
        'search_items'      => 'Шукати Категорії',
        'all_items'         => 'Всі Категорії',
        'parent_item'       => 'Батьківська Категорія',
        'parent_item_colon' => 'Батьківська Категорія:',
        'edit_item'         => 'Редагувати Категорію',
        'update_item'       => 'Оновити Категорію',
        'add_new_item'      => 'Додати Нову Категорію',
        'new_item_name'     => 'Назва Нової Категорії',
        'menu_name'         => 'Категорії Брендів',
    );

    $args = array(
        'hierarchical'      => true,
        'labels'            => $labels,
        'show_ui'           => true,
        'show_admin_column' => true,
        'query_var'         => true,
        'rewrite'           => array('slug' => 'brand-category'),
        'show_in_rest'      => true, // Important for Gutenberg editor
    );

    register_taxonomy('brand_category', array('brand'), $args);
}
add_action('init', 'onecompany_register_brand_category_taxonomy');

// Add Custom Fields for Brands
function onecompany_brand_meta_boxes() {
    add_meta_box(
        'brand_details',
        'Деталі бренду',
        'onecompany_brand_details_callback',
        'brand',
        'normal',
        'high'
    );
}
add_action('add_meta_boxes', 'onecompany_brand_meta_boxes');

function onecompany_brand_details_callback($post) {
    wp_nonce_field('onecompany_brand_meta', 'onecompany_brand_nonce');
    
    $subtitle = get_post_meta($post->ID, '_brand_subtitle', true);
    $video_url = get_post_meta($post->ID, '_brand_video', true);
    $color = get_post_meta($post->ID, '_brand_color', true);
    $features = get_post_meta($post->ID, '_brand_features', true);
    $logo_id = (int) get_post_meta($post->ID, '_brand_logo_id', true);
    $logo_url = $logo_id ? wp_get_attachment_image_url($logo_id, 'medium') : '';
    $poster_id = (int) get_post_meta($post->ID, '_brand_poster_id', true);
    $poster_url = $poster_id ? wp_get_attachment_image_url($poster_id, 'large') : '';
    $site_url = get_post_meta($post->ID, '_brand_site_url', true);
    ?>
    <div class="brand-meta-field">
        <label for="brand_subtitle"><strong>Підзаголовок</strong></label>
        <input type="text" id="brand_subtitle" name="brand_subtitle" value="<?php echo esc_attr($subtitle); ?>" class="widefat">
    </div>

    <div class="brand-meta-grid">
        <div class="brand-media-field" data-field="brand_logo">
            <label><strong>Логотип бренду</strong></label>
            <div class="brand-media-preview">
                <?php if ($logo_url) : ?>
                    <img src="<?php echo esc_url($logo_url); ?>" alt="Brand logo preview">
                <?php else : ?>
                    <span class="brand-media-placeholder">Немає логотипу</span>
                <?php endif; ?>
            </div>
            <input type="hidden" id="brand_logo_id" name="brand_logo_id" value="<?php echo esc_attr($logo_id); ?>">
            <div class="brand-media-actions">
                <button type="button" class="button brand-media-upload" data-target="brand_logo_id">Обрати логотип</button>
                <button type="button" class="button-link brand-media-remove" data-target="brand_logo_id">Прибрати</button>
            </div>
            <p class="description">Рекомендовано SVG або PNG з прозорим фоном.</p>
        </div>

        <div class="brand-media-field" data-field="brand_poster">
            <label><strong>Фонове зображення</strong></label>
            <div class="brand-media-preview">
                <?php if ($poster_url) : ?>
                    <img src="<?php echo esc_url($poster_url); ?>" alt="Brand poster preview">
                <?php else : ?>
                    <span class="brand-media-placeholder">Немає фонового зображення</span>
                <?php endif; ?>
            </div>
            <input type="hidden" id="brand_poster_id" name="brand_poster_id" value="<?php echo esc_attr($poster_id); ?>">
            <div class="brand-media-actions">
                <button type="button" class="button brand-media-upload" data-target="brand_poster_id">Обрати фон</button>
                <button type="button" class="button-link brand-media-remove" data-target="brand_poster_id">Прибрати</button>
            </div>
            <p class="description">Використовується як резерв для відео та в плитці каталогу.</p>
        </div>
    </div>

    <div class="brand-meta-field">
        <label for="brand_video"><strong>URL відео</strong></label>
        <input type="text" id="brand_video" name="brand_video" value="<?php echo esc_attr($video_url); ?>" class="widefat" placeholder="https://.../brand-video.mp4">
        <p class="description">Посилання на MP4 у медіатеці WordPress. Використовується у фоні секції.</p>
    </div>

    <div class="brand-meta-field">
        <label for="brand_color"><strong>Колір бренду (hex)</strong></label>
        <input type="color" id="brand_color" name="brand_color" value="<?php echo esc_attr($color ? $color : '#ff6b00'); ?>">
    </div>

    <div class="brand-meta-field">
        <label for="brand_features"><strong>Особливості (через кому)</strong></label>
        <input type="text" id="brand_features" name="brand_features" value="<?php echo esc_attr($features); ?>" class="widefat" placeholder="Преміум якість, Гарантія, Швидка доставка">
    </div>

    <div class="brand-meta-field">
        <label for="brand_site_url"><strong>Окремий сайт / лендинг</strong></label>
        <input type="url" id="brand_site_url" name="brand_site_url" value="<?php echo esc_attr($site_url); ?>" class="widefat" placeholder="https://brand.onecompany.ua">
        <p class="description">Посилання на підсайт бренду (буде показано у каталозі).</p>
    </div>
    <?php
}

function onecompany_save_brand_meta($post_id) {
    if (!isset($_POST['onecompany_brand_nonce']) || !wp_verify_nonce($_POST['onecompany_brand_nonce'], 'onecompany_brand_meta')) {
        return;
    }

    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
        return;
    }

    if (!current_user_can('edit_post', $post_id)) {
        return;
    }

    if (isset($_POST['brand_subtitle'])) {
        update_post_meta($post_id, '_brand_subtitle', sanitize_text_field($_POST['brand_subtitle']));
    }

    if (isset($_POST['brand_video'])) {
        update_post_meta($post_id, '_brand_video', esc_url_raw($_POST['brand_video']));
    }

    if (isset($_POST['brand_color'])) {
        update_post_meta($post_id, '_brand_color', sanitize_hex_color($_POST['brand_color']));
    }

    if (isset($_POST['brand_features'])) {
        update_post_meta($post_id, '_brand_features', sanitize_text_field($_POST['brand_features']));
    }

    if (isset($_POST['brand_logo_id'])) {
        $logo_id = absint($_POST['brand_logo_id']);
        if ($logo_id > 0) {
            update_post_meta($post_id, '_brand_logo_id', $logo_id);
        } else {
            delete_post_meta($post_id, '_brand_logo_id');
        }
    }

    if (isset($_POST['brand_poster_id'])) {
        $poster_id = absint($_POST['brand_poster_id']);
        if ($poster_id > 0) {
            update_post_meta($post_id, '_brand_poster_id', $poster_id);
        } else {
            delete_post_meta($post_id, '_brand_poster_id');
        }
    }

    if (isset($_POST['brand_site_url'])) {
        $site_url = esc_url_raw(trim($_POST['brand_site_url']));
        if (!empty($site_url)) {
            update_post_meta($post_id, '_brand_site_url', $site_url);
        } else {
            delete_post_meta($post_id, '_brand_site_url');
        }
    }
}
add_action('save_post', 'onecompany_save_brand_meta');

function onecompany_admin_brand_assets($hook) {
    if (!in_array($hook, array('post.php', 'post-new.php'), true)) {
        return;
    }

    $screen = get_current_screen();
    if (!$screen || 'brand' !== $screen->post_type) {
        return;
    }

    wp_enqueue_media();
    wp_enqueue_script(
        'onecompany-brand-media',
        get_template_directory_uri() . '/js/admin-brand-media.js',
        array('jquery'),
        '1.0.0',
        true
    );

    wp_enqueue_style(
        'onecompany-brand-admin',
        get_template_directory_uri() . '/css/admin-brand.css',
        array(),
        '1.0.0'
    );
}
add_action('admin_enqueue_scripts', 'onecompany_admin_brand_assets');

// Navigation Menu
function onecompany_register_menus() {
    register_nav_menus(array(
        'primary' => 'Primary Menu',
    ));
}
add_action('init', 'onecompany_register_menus');

// ===== THEME CUSTOMIZER =====
function onecompany_customize_register($wp_customize) {
    
    // ===== HERO SECTION =====
    $wp_customize->add_section('onecompany_hero', array(
        'title' => 'Hero Section',
        'priority' => 30,
    ));
    
    // Hero Label
    $wp_customize->add_setting('hero_label', array(
        'default' => 'THE ART OF AUTOMOTIVE',
        'sanitize_callback' => 'sanitize_text_field',
    ));
    $wp_customize->add_control('hero_label', array(
        'label' => 'Hero Label',
        'section' => 'onecompany_hero',
        'type' => 'text',
    ));
    
    // Hero Title Line 1
    $wp_customize->add_setting('hero_title_1', array(
        'default' => 'ONE',
        'sanitize_callback' => 'sanitize_text_field',
    ));
    $wp_customize->add_control('hero_title_1', array(
        'label' => 'Hero Title Line 1',
        'section' => 'onecompany_hero',
        'type' => 'text',
    ));
    
    // Hero Title Line 2
    $wp_customize->add_setting('hero_title_2', array(
        'default' => 'COMPANY',
        'sanitize_callback' => 'sanitize_text_field',
    ));
    $wp_customize->add_control('hero_title_2', array(
        'label' => 'Hero Title Line 2',
        'section' => 'onecompany_hero',
        'type' => 'text',
    ));
    
    // Hero Subtitle
    $wp_customize->add_setting('hero_subtitle', array(
        'default' => 'ПРЕМІУМ АВТОМОБІЛЬНІ АКСЕСУАРИ',
        'sanitize_callback' => 'sanitize_text_field',
    ));
    $wp_customize->add_control('hero_subtitle', array(
        'label' => 'Hero Subtitle',
        'section' => 'onecompany_hero',
        'type' => 'text',
    ));
    
    // Hero Video
    $wp_customize->add_setting('hero_video', array(
        'default' => '',
        'sanitize_callback' => 'esc_url_raw',
    ));
    $wp_customize->add_control('hero_video', array(
        'label' => 'Hero Video URL',
        'section' => 'onecompany_hero',
        'type' => 'url',
        'description' => 'Full URL to video file (e.g., /wp-content/uploads/hero.mp4)',
    ));
    
    // ===== STATS SECTION =====
    $wp_customize->add_section('onecompany_stats', array(
        'title' => 'Stats Section',
        'priority' => 31,
    ));
    
    // Stat 1
    $wp_customize->add_setting('stat1_number', array(
        'default' => '500',
        'sanitize_callback' => 'sanitize_text_field',
    ));
    $wp_customize->add_control('stat1_number', array(
        'label' => 'Stat 1 Number',
        'section' => 'onecompany_stats',
        'type' => 'number',
    ));
    
    $wp_customize->add_setting('stat1_label', array(
        'default' => 'ПРОЕКТІВ',
        'sanitize_callback' => 'sanitize_text_field',
    ));
    $wp_customize->add_control('stat1_label', array(
        'label' => 'Stat 1 Label',
        'section' => 'onecompany_stats',
        'type' => 'text',
    ));
    
    // Stat 2
    $wp_customize->add_setting('stat2_number', array(
        'default' => '10',
        'sanitize_callback' => 'sanitize_text_field',
    ));
    $wp_customize->add_control('stat2_number', array(
        'label' => 'Stat 2 Number',
        'section' => 'onecompany_stats',
        'type' => 'number',
    ));
    
    $wp_customize->add_setting('stat2_label', array(
        'default' => 'РОКІВ ДОСВІДУ',
        'sanitize_callback' => 'sanitize_text_field',
    ));
    $wp_customize->add_control('stat2_label', array(
        'label' => 'Stat 2 Label',
        'section' => 'onecompany_stats',
        'type' => 'text',
    ));
    
    // Stat 3
    $wp_customize->add_setting('stat3_number', array(
        'default' => '50',
        'sanitize_callback' => 'sanitize_text_field',
    ));
    $wp_customize->add_control('stat3_number', array(
        'label' => 'Stat 3 Number',
        'section' => 'onecompany_stats',
        'type' => 'number',
    ));
    
    $wp_customize->add_setting('stat3_label', array(
        'default' => 'КРАЇН',
        'sanitize_callback' => 'sanitize_text_field',
    ));
    $wp_customize->add_control('stat3_label', array(
        'label' => 'Stat 3 Label',
        'section' => 'onecompany_stats',
        'type' => 'text',
    ));
    
    // ===== COLORS =====
    $wp_customize->add_section('onecompany_colors', array(
        'title' => 'Theme Colors',
        'priority' => 32,
    ));
    
    $wp_customize->add_setting('accent_color', array(
        'default' => '#ff6b00',
        'sanitize_callback' => 'sanitize_hex_color',
    ));
    $wp_customize->add_control(new WP_Customize_Color_Control($wp_customize, 'accent_color', array(
        'label' => 'Accent Color',
        'section' => 'onecompany_colors',
    )));
    
    // ===== SOCIAL MEDIA =====
    $wp_customize->add_section('onecompany_social', array(
        'title' => 'Social Media',
        'priority' => 33,
    ));
    
    $wp_customize->add_setting('instagram_url', array(
        'default' => 'https://www.instagram.com/onecompany',
        'sanitize_callback' => 'esc_url_raw',
    ));
    $wp_customize->add_control('instagram_url', array(
        'label' => 'Instagram URL',
        'section' => 'onecompany_social',
        'type' => 'url',
    ));
    
    $wp_customize->add_setting('facebook_url', array(
        'default' => 'https://www.facebook.com/onecompany',
        'sanitize_callback' => 'esc_url_raw',
    ));
    $wp_customize->add_control('facebook_url', array(
        'label' => 'Facebook URL',
        'section' => 'onecompany_social',
        'type' => 'url',
    ));
    
    $wp_customize->add_setting('youtube_url', array(
        'default' => 'https://www.youtube.com/@onecompany',
        'sanitize_callback' => 'esc_url_raw',
    ));
    $wp_customize->add_control('youtube_url', array(
        'label' => 'YouTube URL',
        'section' => 'onecompany_social',
        'type' => 'url',
    ));
    
    $wp_customize->add_setting('phone_number', array(
        'default' => '+38 (012) 345-67-89',
        'sanitize_callback' => 'sanitize_text_field',
    ));
    $wp_customize->add_control('phone_number', array(
        'label' => 'Phone Number',
        'section' => 'onecompany_social',
        'type' => 'tel',
    ));
    
    // ===== CONTACT INFO =====
    $wp_customize->add_section('onecompany_contact', array(
        'title' => 'Contact Info',
        'priority' => 34,
    ));
    
    $wp_customize->add_setting('contact_email', array(
        'default' => 'info@onecompany.com',
        'sanitize_callback' => 'sanitize_email',
    ));
    $wp_customize->add_control('contact_email', array(
        'label' => 'Email',
        'section' => 'onecompany_contact',
        'type' => 'email',
    ));
    
    $wp_customize->add_setting('contact_address', array(
        'default' => 'Україна, Київ',
        'sanitize_callback' => 'sanitize_text_field',
    ));
    $wp_customize->add_control('contact_address', array(
        'label' => 'Address',
        'section' => 'onecompany_contact',
        'type' => 'text',
    ));
    
    $wp_customize->add_setting('footer_text', array(
        'default' => 'Ми спеціалізуємося на преміальних автомобільних аксесуарах та тюнінгу. KW, Fi Exhaust, Eventuri - тільки найкраще для вашого автомобіля.',
        'sanitize_callback' => 'sanitize_textarea_field',
    ));
    $wp_customize->add_control('footer_text', array(
        'label' => 'Footer Description',
        'section' => 'onecompany_contact',
        'type' => 'textarea',
    ));

    // Footer Copyright
    $wp_customize->add_setting('footer_copyright', array(
        'default'   => '&copy; ' . date('Y') . ' OneCompany. All rights reserved.',
        'transport' => 'refresh',
        'sanitize_callback' => 'wp_kses_post',
    ));
    $wp_customize->add_control('footer_copyright', array(
        'label'   => __('Copyright Text', 'onecompany'),
        'section' => 'onecompany_contact',
        'type'    => 'textarea',
    ));
}
add_action('customize_register', 'onecompany_customize_register');

/**
 * Register Widget Areas
 */
function onecompany_widgets_init() {
    register_sidebar(array(
        'name'          => __('Footer Column 1', 'onecompany'),
        'id'            => 'footer-1',
        'description'   => __('Widgets in this area will be shown in the first footer column.', 'onecompany'),
        'before_widget' => '<div id="%1$s" class="footer-widget liquid-panel liquid-panel--dark %2$s">',
        'after_widget'  => '</div>',
        'before_title'  => '<h3 class="widget-title">',
        'after_title'   => '</h3>',
    ));

    register_sidebar(array(
        'name'          => __('Footer Column 2', 'onecompany'),
        'id'            => 'footer-2',
        'description'   => __('Widgets in this area will be shown in the second footer column.', 'onecompany'),
        'before_widget' => '<div id="%1$s" class="footer-widget liquid-panel liquid-panel--dark %2$s">',
        'after_widget'  => '</div>',
        'before_title'  => '<h3 class="widget-title">',
        'after_title'   => '</h3>',
    ));

    register_sidebar(array(
        'name'          => __('Footer Column 3', 'onecompany'),
        'id'            => 'footer-3',
        'description'   => __('Widgets in this area will be shown in the third footer column.', 'onecompany'),
        'before_widget' => '<div id="%1$s" class="footer-widget liquid-panel liquid-panel--dark %2$s">',
        'after_widget'  => '</div>',
        'before_title'  => '<h3 class="widget-title">',
        'after_title'   => '</h3>',
    ));

    register_sidebar(array(
        'name'          => __('Footer Column 4', 'onecompany'),
        'id'            => 'footer-4',
        'description'   => __('Widgets in this area will be shown in the fourth footer column.', 'onecompany'),
        'before_widget' => '<div id="%1$s" class="footer-widget liquid-panel liquid-panel--dark %2$s">',
        'after_widget'  => '</div>',
        'before_title'  => '<h3 class="widget-title">',
        'after_title'   => '</h3>',
    ));
}
add_action('widgets_init', 'onecompany_widgets_init');

// ===== OUTPUT CUSTOMIZER CSS =====
function onecompany_customizer_css() {
    ?>
    <style type="text/css">
        :root {
            --accent: <?php echo get_theme_mod('accent_color', '#ff6b00'); ?>;
        }
    </style>
    <?php
}
add_action('wp_head', 'onecompany_customizer_css');

// ===== GUTENBERG BLOCKS =====
function onecompany_register_blocks() {
    // Register block category
    add_filter('block_categories_all', function($categories) {
        return array_merge(
            array(
                array(
                    'slug'  => 'onecompany',
                    'title' => 'OneCompany Blocks'
                )
            ),
            $categories
        );
    });
    
    // Register Hero Block
    register_block_type(__DIR__ . '/blocks/hero-block');
    
    // Register Brand Slide Block
    register_block_type(__DIR__ . '/blocks/brand-slide');

    // Register Brand Grid Block
    register_block_type(__DIR__ . '/blocks/brand-grid-block');
    
    // Register Contact Form Block
    register_block_type(__DIR__ . '/blocks/contact-form-block');
    
    // Register Gallery Block
    register_block_type(__DIR__ . '/blocks/gallery-block');
}
add_action('init', 'onecompany_register_blocks');

/**
 * Setup navigation menu on theme activation.
 */
function onecompany_setup_navigation_menu() {
    $menu_name = 'Primary Menu';
    $menu_location = 'primary';
    $menu_exists = wp_get_nav_menu_object($menu_name);

    if (!$menu_exists) {
        $menu_id = wp_create_nav_menu($menu_name);

        // Add items to the menu
        wp_update_nav_menu_item($menu_id, 0, [
            'menu-item-title'  => 'Головна',
            'menu-item-url'    => home_url('/'),
            'menu-item-status' => 'publish'
        ]);
        wp_update_nav_menu_item($menu_id, 0, [
            'menu-item-title'  => 'Бренди',
            'menu-item-url'    => home_url('/#brands'),
            'menu-item-status' => 'publish'
        ]);
        wp_update_nav_menu_item($menu_id, 0, [
            'menu-item-title'  => 'Галерея',
            'menu-item-url'    => home_url('/#gallery'),
            'menu-item-status' => 'publish'
        ]);
        wp_update_nav_menu_item($menu_id, 0, [
            'menu-item-title'  => 'Контакти',
            'menu-item-url'    => home_url('/#contact'),
            'menu-item-status' => 'publish'
        ]);

        // Assign the menu to the 'primary' location
        $locations = get_theme_mod('nav_menu_locations');
        $locations[$menu_location] = $menu_id;
        set_theme_mod('nav_menu_locations', $locations);
    }
}
add_action('after_setup_theme', 'onecompany_setup_navigation_menu');

/**
 * Handle Premium Contact Form submission via AJAX.
 */
function onecompany_handle_premium_contact_form() {
    // 1. Verify nonce for security
    if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'onecompany_contact_form_nonce')) {
        wp_send_json_error(['message' => 'Перевірка безпеки не вдалася.'], 403);
        return;
    }

    // 2. Sanitize and validate form data
    $name = isset($_POST['contact_name']) ? sanitize_text_field($_POST['contact_name']) : '';
    $email = isset($_POST['contact_email']) ? sanitize_email($_POST['contact_email']) : '';
    $phone = isset($_POST['contact_phone']) ? sanitize_text_field($_POST['contact_phone']) : '';
    $message = isset($_POST['contact_message']) ? sanitize_textarea_field($_POST['contact_message']) : '';
    $recipient_email = isset($_POST['recipient_email']) ? sanitize_email($_POST['recipient_email']) : get_option('admin_email');

    // Basic server-side validation
    if (empty($name) || !is_email($email) || empty($message)) {
        wp_send_json_error(['message' => 'Будь ласка, заповніть всі обов\'язкові поля.'], 400);
        return;
    }

    if (!is_email($recipient_email)) {
        $recipient_email = get_option('admin_email');
    }

    // 3. Prepare and send the email
    $subject = sprintf('Нове повідомлення від %s з сайту OneCompany', $name);
    $headers = ['Content-Type: text/html; charset=UTF-8', 'Reply-To: ' . $name . ' <' . $email . '>'];

    $body = "<html><body>";
    $body .= "<h2>Нове повідомлення з контактної форми</h2>";
    $body .= "<p><strong>Ім'я:</strong> " . esc_html($name) . "</p>";
    $body .= "<p><strong>Email:</strong> " . esc_html($email) . "</p>";
    if (!empty($phone)) {
        $body .= "<p><strong>Телефон:</strong> " . esc_html($phone) . "</p>";
    }
    $body .= "<p><strong>Повідомлення:</strong><br>" . nl2br(esc_html($message)) . "</p>";
    $body .= "<hr>";
    $body .= "<p><small>Відправлено з " . get_bloginfo('name') . "</small></p>";
    $body .= "</body></html>";

    $sent = wp_mail($recipient_email, $subject, $body, $headers);

    // 4. Send JSON response
    if ($sent) {
        wp_send_json_success(['message' => 'Повідомлення успішно надіслано!']);
    } else {
        wp_send_json_error(['message' => 'Не вдалося надіслати повідомлення. Спробуйте пізніше.'], 500);
    }
}

// Hook for both logged-in and non-logged-in users
add_action('wp_ajax_send_onecompany_contact_form', 'onecompany_handle_premium_contact_form');
add_action('wp_ajax_nopriv_send_onecompany_contact_form', 'onecompany_handle_premium_contact_form');

// Include block patterns
require_once get_template_directory() . '/patterns.php';
