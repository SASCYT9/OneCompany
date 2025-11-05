<?php
/**
 * The template for displaying a single brand.
 *
 * @package OneCompany
 */

get_header();

while (have_posts()) :
    the_post();

    $subtitle = get_post_meta(get_the_ID(), '_brand_subtitle', true);
    $video_url = get_post_meta(get_the_ID(), '_brand_video', true);
    $color = get_post_meta(get_the_ID(), '_brand_color', true) ?: '#333';
    $features = get_post_meta(get_the_ID(), '_brand_features', true);
    $features_array = $features ? array_map('trim', explode(',', $features)) : [];
?>

<main id="primary" class="site-main single-brand-page" style="--brand-color: <?php echo esc_attr($color); ?>;">

    <header class="single-brand-hero">
        <div class="single-brand-hero__background">
            <?php if ($video_url) : ?>
                <video class="single-brand-hero__video" autoplay muted loop playsinline preload="auto">
                    <source src="<?php echo esc_url($video_url); ?>" type="video/mp4">
                </video>
            <?php elseif (has_post_thumbnail()) : ?>
                <?php the_post_thumbnail('full', ['class' => 'single-brand-hero__image']); ?>
            <?php endif; ?>
            <div class="single-brand-hero__overlay"></div>
        </div>
        <div class="single-brand-hero__content container">
            <?php if ($subtitle) : ?>
                <p class="single-brand-hero__subtitle"><?php echo esc_html($subtitle); ?></p>
            <?php endif; ?>
            <h1 class="single-brand-hero__title"><?php the_title(); ?></h1>
            <div class="single-brand-hero__scroll-indicator">
                <span>Дізнатись більше</span>
                <div class="arrow">&darr;</div>
            </div>
        </div>
    </header>

    <article id="post-<?php the_ID(); ?>" <?php post_class('container'); ?>>
        <div class="single-brand-content">
            <div class="entry-content">
                <?php the_content(); ?>
            </div>

            <?php if (!empty($features_array)) : ?>
                <div class="brand-features-section">
                    <h2 class="section-title">Ключові особливості</h2>
                    <ul class="brand-features-list">
                        <?php foreach ($features_array as $feature) : ?>
                            <li class="brand-feature-item">
                                <span class="feature-icon">&check;</span>
                                <span class="feature-text"><?php echo esc_html($feature); ?></span>
                            </li>
                        <?php endforeach; ?>
                    </ul>
                </div>
            <?php endif; ?>
        </div>
    </article>

    <section class="brand-gallery-section container">
        <h2 class="section-title">Галерея</h2>
        <div class="brand-gallery-placeholder">
            <p>Тут буде галерея зображень та відео, пов'язаних з брендом.</p>
            <p>Цей функціонал буде додано в наступних оновленнях.</p>
        </div>
    </section>

    <section class="brand-cta-section">
        <div class="container">
            <h2 class="cta-title">Зацікавив бренд?</h2>
            <p class="cta-subtitle">Зв'яжіться з нами для консультації та замовлення.</p>
            <a href="<?php echo esc_url(get_theme_mod('contact_page_url', '#contact')); ?>" class="premium-btn">
                <span class="premium-btn__text">Зв'язатись з нами</span>
                <span class="premium-btn__shimmer"></span>
            </a>
        </div>
    </section>

</main><!-- #main -->

<?php
endwhile; // End of the loop.
get_footer();
