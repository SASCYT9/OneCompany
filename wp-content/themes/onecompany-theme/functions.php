<?php
/**
 * OneCompany Premium Theme
 * functions.php
 */

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

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
