<?php
/**
 * Plugin Name: OneCompany Homepage Creator
 * Description: Створює повноцінну homepage одним кліком
 * Version: 1.0.0
 * Author: OneCompany
 */

// Додаємо меню в адмінці
add_action('admin_menu', 'onecompany_homepage_menu');

function onecompany_homepage_menu() {
    add_management_page(
        'Create Homepage',
        '🏠 Create Homepage',
        'manage_options',
        'onecompany-homepage',
        'onecompany_homepage_page'
    );
}

// Сторінка плагіна
function onecompany_homepage_page() {
    if (!current_user_can('manage_options')) {
        wp_die('Access denied');
    }

    // Обробка форми
    if (isset($_POST['create_homepage']) && check_admin_referer('create_homepage_action')) {
        onecompany_create_homepage();
    }
    
    ?>
    <div class="wrap">
        <h1>🏠 OneCompany Homepage Creator</h1>
        <p>Створить повноцінну homepage з усіма блоками одним кліком!</p>
        
        <div style="background: #fff; padding: 20px; border-left: 4px solid #c9a961; margin: 20px 0;">
            <h2>📦 Що буде створено:</h2>
            <ul style="font-size: 16px; line-height: 2;">
                <li>✨ <strong>Hero Block</strong> - Головний банер з відео фоном</li>
                <li>🏁 <strong>Brand Grid</strong> - Сітка з 50 преміальних брендів (5 колонок)</li>
                <li>🎨 <strong>Liquid Gallery</strong> - Showcase проєктів</li>
                <li>📧 <strong>Contact Form</strong> - Форма зв'язку</li>
            </ul>
        </div>
        
        <form method="post" style="margin-top: 30px;">
            <?php wp_nonce_field('create_homepage_action'); ?>
            <button type="submit" name="create_homepage" class="button button-primary button-hero" style="background: #c9a961; border-color: #c9a961; font-size: 18px; padding: 10px 30px;">
                🚀 Створити Homepage зараз
            </button>
        </form>
        
        <div style="margin-top: 30px; padding: 15px; background: #f0f0f0; border-radius: 4px;">
            <p><strong>💡 Після створення:</strong></p>
            <ul>
                <li>Homepage буде автоматично встановлено як головну сторінку</li>
                <li>Ви зможете редагувати її в Pages → Home</li>
                <li>Всі блоки будуть налаштовані з оптимальними параметрами</li>
            </ul>
        </div>
    </div>
    <?php
}

// Функція створення Homepage
function onecompany_create_homepage() {
    // Gutenberg блоки
    $homepage_content = <<<'EOD'
<!-- wp:onecompany/hero-block {"title":"ONECOMPANY","subtitle":"premium tuning parts. 180+ brands. one company.","videoUrl":"","accentColor":"#c9a961"} /-->

<!-- wp:spacer {"height":"60px"} -->
<div style="height:60px" aria-hidden="true" class="wp-block-spacer"></div>
<!-- /wp:spacer -->

<!-- wp:group {"style":{"spacing":{"padding":{"top":"80px","bottom":"80px","left":"20px","right":"20px"}},"color":{"background":"#0a0a0a"}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group has-background" style="background-color:#0a0a0a;padding-top:80px;padding-right:20px;padding-bottom:80px;padding-left:20px">

<!-- wp:heading {"textAlign":"center","style":{"typography":{"fontSize":"52px","fontWeight":"900","letterSpacing":"3px"},"spacing":{"margin":{"bottom":"20px"}},"color":{"text":"#ffffff"}}} -->
<h2 class="wp-block-heading has-text-align-center has-text-color" style="color:#ffffff;margin-bottom:20px;font-size:52px;font-weight:900;letter-spacing:3px">🏁 PREMIUM BRANDS</h2>
<!-- /wp:heading -->

<!-- wp:paragraph {"align":"center","style":{"typography":{"fontSize":"20px"},"spacing":{"margin":{"bottom":"60px"}},"color":{"text":"#c9a961"}}} -->
<p class="has-text-align-center has-text-color" style="color:#c9a961;margin-bottom:60px;font-size:20px">Найкращі світові бренди автомобільного тюнінгу в одному місці</p>
<!-- /wp:paragraph -->

<!-- wp:onecompany/brand-grid-block {"numberOfPosts":50,"columns":5,"showDescription":true} /-->

</div>
<!-- /wp:group -->

<!-- wp:spacer {"height":"80px"} -->
<div style="height:80px" aria-hidden="true" class="wp-block-spacer"></div>
<!-- /wp:spacer -->

<!-- wp:group {"style":{"spacing":{"padding":{"top":"60px","bottom":"60px","left":"20px","right":"20px"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group" style="padding-top:60px;padding-right:20px;padding-bottom:60px;padding-left:20px">

<!-- wp:heading {"textAlign":"center","style":{"typography":{"fontSize":"52px","fontWeight":"900","letterSpacing":"3px"},"spacing":{"margin":{"bottom":"20px"}}}} -->
<h2 class="wp-block-heading has-text-align-center" style="margin-bottom:20px;font-size:52px;font-weight:900;letter-spacing:3px">🎨 SHOWCASE</h2>
<!-- /wp:heading -->

<!-- wp:paragraph {"align":"center","style":{"typography":{"fontSize":"18px"},"spacing":{"margin":{"bottom":"60px"}}}} -->
<p class="has-text-align-center" style="margin-bottom:60px;font-size:18px">Наші проєкти та реалізації преміального тюнінгу</p>
<!-- /wp:paragraph -->

<!-- wp:onecompany/gallery-block /-->

</div>
<!-- /wp:group -->

<!-- wp:spacer {"height":"80px"} -->
<div style="height:80px" aria-hidden="true" class="wp-block-spacer"></div>
<!-- /wp:spacer -->

<!-- wp:group {"style":{"spacing":{"padding":{"top":"80px","bottom":"80px","left":"20px","right":"20px"}},"color":{"background":"#0a0a0a"}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group has-background" style="background-color:#0a0a0a;padding-top:80px;padding-right:20px;padding-bottom:80px;padding-left:20px">

<!-- wp:heading {"textAlign":"center","style":{"typography":{"fontSize":"52px","fontWeight":"900","letterSpacing":"3px"},"spacing":{"margin":{"bottom":"20px"}},"color":{"text":"#ffffff"}}} -->
<h2 class="wp-block-heading has-text-align-center has-text-color" style="color:#ffffff;margin-bottom:20px;font-size:52px;font-weight:900;letter-spacing:3px">📧 CONTACT US</h2>
<!-- /wp:heading -->

<!-- wp:paragraph {"align":"center","style":{"typography":{"fontSize":"18px"},"spacing":{"margin":{"bottom":"60px"}},"color":{"text":"#c9a961"}}} -->
<p class="has-text-align-center has-text-color" style="color:#c9a961;margin-bottom:60px;font-size:18px">Зв'яжіться з нами для консультації по преміальному тюнінгу</p>
<!-- /wp:paragraph -->

<!-- wp:onecompany/contact-form-block /-->

</div>
<!-- /wp:group -->

<!-- wp:spacer {"height":"40px"} -->
<div style="height:40px" aria-hidden="true" class="wp-block-spacer"></div>
<!-- /wp:spacer -->
EOD;

    // Перевіряємо чи існує Homepage
    $existing_page = get_page_by_title('Home', OBJECT, 'page');

    if ($existing_page) {
        // Оновлюємо існуючу
        $page_id = wp_update_post([
            'ID' => $existing_page->ID,
            'post_content' => $homepage_content,
            'post_status' => 'publish'
        ]);
        
        echo '<div class="notice notice-success"><p>✅ <strong>Homepage ОНОВЛЕНО!</strong> ID: ' . $page_id . '</p></div>';
    } else {
        // Створюємо нову
        $page_id = wp_insert_post([
            'post_title' => 'Home',
            'post_content' => $homepage_content,
            'post_status' => 'publish',
            'post_type' => 'page',
            'post_author' => get_current_user_id(),
            'comment_status' => 'closed',
            'ping_status' => 'closed'
        ]);
        
        echo '<div class="notice notice-success"><p>✅ <strong>Homepage СТВОРЕНО!</strong> ID: ' . $page_id . '</p></div>';
    }

    // Встановлюємо як головну сторінку
    update_option('page_on_front', $page_id);
    update_option('show_on_front', 'page');

    echo '<div class="notice notice-success"><p>✅ <strong>Встановлено як головну сторінку сайту!</strong></p></div>';
    echo '<div class="notice notice-info"><p>🌐 <strong>Відкрийте:</strong> <a href="' . home_url() . '" target="_blank">' . home_url() . '</a></p></div>';
    echo '<div class="notice notice-info"><p>📝 <strong>Редагувати:</strong> <a href="' . admin_url('post.php?post=' . $page_id . '&action=edit') . '">Edit Homepage</a></p></div>';
}
