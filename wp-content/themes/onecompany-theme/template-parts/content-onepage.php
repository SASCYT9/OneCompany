<?php
/**
 * Shared markup for the OneCompany one-page layout.
 * Version: 2.1 - Injected with premium media assets.
 */

// Hero configuration
$hero_label = trim(get_theme_mod('hero_label', 'THE ART OF AUTOMOTIVE'));
$hero_title_one = trim(get_theme_mod('hero_title_1', 'ONE'));
$hero_title_two = trim(get_theme_mod('hero_title_2', 'COMPANY'));
$hero_title_parts = array_filter([$hero_title_one, $hero_title_two], static function ($part) {
    return $part !== '';
});
$hero_title = !empty($hero_title_parts) ? implode(' ', $hero_title_parts) : 'OneCompany Atelier';
$hero_subtitle = trim(get_theme_mod('hero_subtitle', 'Преміум автотюнінг. Три напрями. Одна філософія.'));
$hero_video_url = get_theme_mod('hero_video');
$hero_video = !empty($hero_video_url) ? esc_url($hero_video_url) : '/videos/hero-background-dark.mp4';

// Premium media references (stubbed for demo purposes)
$premium_assets = [
    'eventuri' => [
        'logo'   => '/images/eventuri/eventuri-logo-white.svg',
        'poster' => '/images/eventuri/eventuri-poster-bmw-m4.jpg',
    ],
    'fi-exhaust' => [
        'logo'   => '/images/fi/fi-exhaust-logo-white.svg',
        'poster' => '/images/fi/fi-exhaust-poster-lambo.jpg',
    ],
    'kw-suspension' => [
        'logo'   => '/images/kw/kw-logo-white.svg',
        'poster' => '/images/kw/kw-poster-porsche-gt3.jpg',
    ],
];

// Gather brand information
$brands_query = new WP_Query([
    'post_type'      => 'brand',
    'posts_per_page' => -1,
    'orderby'        => 'menu_order',
    'order'          => 'ASC',
]);

$brand_items = [];
if ($brands_query->have_posts()) {
    while ($brands_query->have_posts()) {
        $brands_query->the_post();
        $brand_id = get_the_ID();
        $slug = get_post_field('post_name', $brand_id);

        $features_raw = get_post_meta($brand_id, '_brand_features', true);
        $features = $features_raw ? array_filter(array_map('trim', explode(',', $features_raw))) : [];

        $terms = wp_get_post_terms($brand_id, 'brand_category');
        $categories = [];
        if (!is_wp_error($terms) && !empty($terms)) {
            foreach ($terms as $term) {
                $categories[] = $term->name;
            }
        }

        $brand_logo_id = (int) get_post_meta($brand_id, '_brand_logo_id', true);
        $brand_poster_id = (int) get_post_meta($brand_id, '_brand_poster_id', true);

        $brand_logo = $brand_logo_id ? wp_get_attachment_image_url($brand_logo_id, 'medium') : '';
        $brand_poster = $brand_poster_id ? wp_get_attachment_image_url($brand_poster_id, 'large') : get_the_post_thumbnail_url($brand_id, 'full');

        if (isset($premium_assets[$slug]['logo'])) {
            $brand_logo = $premium_assets[$slug]['logo'];
        }

        if (isset($premium_assets[$slug]['poster'])) {
            $brand_poster = $premium_assets[$slug]['poster'];
        }

        $content = get_the_content(null, false);
        $summary_source = $content ? wp_strip_all_tags($content) : get_post_meta($brand_id, '_brand_subtitle', true);
        $summary = $summary_source ? wp_trim_words($summary_source, 28, '…') : '';

        $tags = !empty($categories) ? $categories : $features;

        $brand_items[] = [
            'slug'      => $slug,
            'title'     => get_the_title(),
            'subtitle'  => get_post_meta($brand_id, '_brand_subtitle', true),
            'summary'   => $summary,
            'poster'    => $brand_poster,
            'logo'      => $brand_logo,
            'site_url'  => get_post_meta($brand_id, '_brand_site_url', true) ? esc_url(get_post_meta($brand_id, '_brand_site_url', true)) : '',
            'tags'      => array_slice($tags, 0, 4),
        ];
    }
}
wp_reset_postdata();

$brand_count = count($brand_items);
?>

<section class="hero reveal" id="hero">
    <?php if (!empty($hero_video)) : ?>
        <div class="hero__media">
            <video autoplay loop muted playsinline>
                <source src="<?php echo esc_url($hero_video); ?>" type="video/mp4">
            </video>
            <div class="hero__scrim"></div>
        </div>
    <?php endif; ?>

    <div class="hero__inner">
        <?php if (!empty($hero_label)) : ?>
            <span class="hero__eyebrow"><?php echo esc_html($hero_label); ?></span>
        <?php endif; ?>

        <h1 class="hero__title"><?php echo esc_html($hero_title); ?></h1>

        <?php if (!empty($hero_subtitle)) : ?>
            <p class="hero__subtitle"><?php echo esc_html($hero_subtitle); ?></p>
        <?php endif; ?>

        <div class="hero__cta">
            <a class="hero__button" href="<?php echo esc_url(home_url('/catalogue')); ?>">Портфоліо брендів</a>
            <a class="hero__button hero__button--ghost" href="<?php echo esc_url(home_url('/contact')); ?>">Приватна консультація</a>
        </div>
    </div>
</section>

<?php if ($brand_count > 0) : ?>
    <section class="brands reveal" id="brands">
        <div class="section-heading">
            <span class="section-heading__eyebrow">Колекція</span>
            <h2 class="section-heading__title">Ключові партнери OneCompany</h2>
            <p class="section-heading__subtitle">Вибрані бренди, з якими ми працюємо офіційно та ексклюзивно. Кожен стенд — це готовий проєкт для преміального клієнта.</p>
        </div>

        <div class="brands-grid">
            <?php foreach ($brand_items as $brand) :
                $background_style = !empty($brand['poster']) ? sprintf('--brand-image: url(%s);', esc_url_raw($brand['poster'])) : '';
                $logo_alt = sprintf('%s logo', $brand['title']);
                $brand_initial = function_exists('mb_substr') ? mb_substr($brand['title'], 0, 1) : substr($brand['title'], 0, 1);
            ?>
                <article class="brand-card"<?php echo $background_style ? ' style="' . esc_attr($background_style) . '"' : ''; ?>>
                    <div class="brand-card__content">
                        <div class="brand-card__meta">
                            <span class="brand-card__logo">
                                <?php if (!empty($brand['logo'])) : ?>
                                    <img src="<?php echo esc_url($brand['logo']); ?>" alt="<?php echo esc_attr($logo_alt); ?>">
                                <?php else : ?>
                                    <span><?php echo esc_html($brand_initial); ?></span>
                                <?php endif; ?>
                            </span>
                            <div>
                                <h3 class="brand-card__title"><?php echo esc_html($brand['title']); ?></h3>
                                <?php if (!empty($brand['subtitle'])) : ?>
                                    <p class="brand-card__subtitle"><?php echo esc_html($brand['subtitle']); ?></p>
                                <?php endif; ?>
                            </div>
                        </div>

                        <?php if (!empty($brand['summary'])) : ?>
                            <p class="brand-card__subtitle"><?php echo esc_html($brand['summary']); ?></p>
                        <?php endif; ?>

                        <?php if (!empty($brand['tags'])) : ?>
                            <div class="brand-card__tags">
                                <?php foreach ($brand['tags'] as $tag) : ?>
                                    <span class="brand-card__tag"><?php echo esc_html($tag); ?></span>
                                <?php endforeach; ?>
                            </div>
                        <?php endif; ?>

                        <?php if (!empty($brand['site_url'])) : ?>
                            <a class="brand-card__cta" href="<?php echo esc_url($brand['site_url']); ?>" target="_blank" rel="noopener noreferrer">Перейти на сайт</a>
                        <?php else : ?>
                            <a class="brand-card__cta" href="<?php echo esc_url(home_url('/contact')); ?>">Запитати доступність</a>
                        <?php endif; ?>
                    </div>
                </article>
            <?php endforeach; ?>
        </div>
    </section>
<?php endif; ?>

<section class="cta-banner reveal" id="contact">
    <h2 class="cta-banner__title">Почнімо проєкт для вашого автомобіля</h2>
    <p>OneCompany — офіційний дистриб’ютор преміальних брендів. Ми працюємо з клубними клієнтами, дилерствами та майстернями, яким потрібен максимальний рівень сервісу.</p>
    <div class="cta-banner__actions">
        <a class="cta-banner__button" href="<?php echo esc_url(home_url('/contact')); ?>">Записатись на дзвінок</a>
        <a class="cta-banner__button cta-banner__button--ghost" href="<?php echo esc_url(home_url('/about')); ?>">Переглянути студію</a>
    </div>
</section>
