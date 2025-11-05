<?php
/**
 * The template for displaying the brand archive.
 *
 * @link https://developer.wordpress.org/themes/basics/template-hierarchy/
 *
 * @package OneCompany
 */

get_header();
?>

<main id="primary" class="site-main brand-archive-page">

    <header class="brand-archive-header">
        <div class="container">
            <h1 class="page-title">Наші Бренди</h1>
            <p class="page-subtitle">Колекція преміальних автомобільних рішень, які ми представляємо.</p>
            
            <div class="brand-filters">
                <button class="filter-btn active" data-filter="*">Всі</button>
                <?php
                $terms = get_terms(array(
                    'taxonomy' => 'brand_category',
                    'hide_empty' => true,
                ));
                if (!empty($terms) && !is_wp_error($terms)) {
                    foreach ($terms as $term) {
                        echo '<button class="filter-btn" data-filter=".' . esc_attr($term->slug) . '">' . esc_html($term->name) . '</button>';
                    }
                }
                ?>
            </div>
        </div>
    </header>

    <div class="brand-grid-container container">
        <div class="brand-grid">
            <?php if (have_posts()) : ?>
                <?php
                while (have_posts()) :
                    the_post();
                    $terms = get_the_terms(get_the_ID(), 'brand_category');
                    $cats = '';
                    if ($terms && !is_wp_error($terms)) {
                        foreach ($terms as $term) {
                            $cats .= ' ' . $term->slug;
                        }
                    }
                    $color = get_post_meta(get_the_ID(), '_brand_color', true) ?: '#333';
                    ?>
                    <a href="<?php the_permalink(); ?>" class="brand-card-link <?php echo esc_attr($cats); ?>">
                        <div class="brand-card" style="--brand-color: <?php echo esc_attr($color); ?>">
                            <div class="brand-card__bg-wrapper">
                                <?php if (has_post_thumbnail()) : ?>
                                    <?php the_post_thumbnail('large', ['class' => 'brand-card__bg']); ?>
                                <?php endif; ?>
                                <div class="brand-card__overlay"></div>
                            </div>
                            <div class="brand-card__content">
                                <h3 class="brand-card__title"><?php the_title(); ?></h3>
                                <?php
                                $subtitle = get_post_meta(get_the_ID(), '_brand_subtitle', true);
                                if ($subtitle) :
                                ?>
                                <p class="brand-card__subtitle"><?php echo esc_html($subtitle); ?></p>
                                <?php endif; ?>
                            </div>
                            <span class="brand-card__arrow">&rarr;</span>
                        </div>
                    </a>
                <?php endwhile; ?>
            <?php else : ?>
                <p>Брендів не знайдено.</p>
            <?php endif; ?>
        </div>
    </div>

</main><!-- #main -->

<?php
get_footer();
