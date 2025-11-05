<?php
/**
 * OneCompany Homepage Creator
 * Створює повноцінну homepage з усіма блоками
 */

require_once(__DIR__ . '/../../../wp-load.php');

// Перевірка прав адміністратора
if (!current_user_can('manage_options')) {
    die('Access denied');
}

// Gutenberg блоки для homepage
$homepage_content = <<<'EOD'
<!-- wp:onecompany/hero-block {"title":"ONECOMPANY","subtitle":"premium tuning parts. 180+ brands. one company.","videoUrl":"","accentColor":"#c9a961"} /-->

<!-- wp:spacer {"height":"60px"} -->
<div style="height:60px" aria-hidden="true" class="wp-block-spacer"></div>
<!-- /wp:spacer -->

<!-- wp:group {"style":{"spacing":{"padding":{"top":"80px","bottom":"80px"}}},"backgroundColor":"black","layout":{"type":"constrained"}} -->
<div class="wp-block-group has-black-background-color has-background" style="padding-top:80px;padding-bottom:80px">

<!-- wp:heading {"textAlign":"center","style":{"typography":{"fontSize":"52px","fontWeight":"900","letterSpacing":"3px"},"spacing":{"margin":{"bottom":"20px"}}}} -->
<h2 class="wp-block-heading has-text-align-center" style="margin-bottom:20px;font-size:52px;font-weight:900;letter-spacing:3px">🏁 PREMIUM BRANDS</h2>
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

<!-- wp:group {"style":{"spacing":{"padding":{"top":"60px","bottom":"60px"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group" style="padding-top:60px;padding-bottom:60px">

<!-- wp:heading {"textAlign":"center","style":{"typography":{"fontSize":"52px","fontWeight":"900","letterSpacing":"3px"},"spacing":{"margin":{"bottom":"20px"}}}} -->
<h2 class="wp-block-heading has-text-align-center" style="margin-bottom:20px;font-size:52px;font-weight:900;letter-spacing:3px">🎨 SHOWCASE</h2>
<!-- /wp:heading -->

<!-- wp:paragraph {"align":"center","style":{"typography":{"fontSize":"18px"},"spacing":{"margin":{"bottom":"60px"}}}} -->
<p class="has-text-align-center" style="margin-bottom:60px;font-size:18px">Наші проєкти та реалізації</p>
<!-- /wp:paragraph -->

<!-- wp:onecompany/gallery-block /-->

</div>
<!-- /wp:group -->

<!-- wp:spacer {"height":"80px"} -->
<div style="height:80px" aria-hidden="true" class="wp-block-spacer"></div>
<!-- /wp:spacer -->

<!-- wp:group {"style":{"spacing":{"padding":{"top":"80px","bottom":"80px"}},"color":{"background":"#0a0a0a"}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group has-background" style="background-color:#0a0a0a;padding-top:80px;padding-bottom:80px">

<!-- wp:heading {"textAlign":"center","style":{"typography":{"fontSize":"52px","fontWeight":"900","letterSpacing":"3px"},"spacing":{"margin":{"bottom":"20px"}}}} -->
<h2 class="wp-block-heading has-text-align-center" style="margin-bottom:20px;font-size:52px;font-weight:900;letter-spacing:3px">📧 CONTACT US</h2>
<!-- /wp:heading -->

<!-- wp:paragraph {"align":"center","style":{"typography":{"fontSize":"18px"},"spacing":{"margin":{"bottom":"60px"}},"color":{"text":"#c9a961"}}} -->
<p class="has-text-align-center has-text-color" style="color:#c9a961;margin-bottom:60px;font-size:18px">Зв'яжіться з нами для консультації</p>
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
    // Оновлюємо існуючу сторінку
    $page_id = wp_update_post([
        'ID' => $existing_page->ID,
        'post_content' => $homepage_content,
        'post_status' => 'publish'
    ]);
    
    echo "✅ Homepage ОНОВЛЕНО! ID: {$page_id}\n";
} else {
    // Створюємо нову Homepage
    $page_id = wp_insert_post([
        'post_title' => 'Home',
        'post_content' => $homepage_content,
        'post_status' => 'publish',
        'post_type' => 'page',
        'post_author' => 1,
        'comment_status' => 'closed',
        'ping_status' => 'closed'
    ]);
    
    echo "✅ Homepage СТВОРЕНО! ID: {$page_id}\n";
}

// Встановлюємо як головну сторінку
update_option('page_on_front', $page_id);
update_option('show_on_front', 'page');

echo "✅ Встановлено як головну сторінку сайту!\n";
echo "\n🌐 Відкрийте: http://localhost:8080/\n";
echo "📝 Редагувати: http://localhost:8080/wp-admin/post.php?post={$page_id}&action=edit\n";
