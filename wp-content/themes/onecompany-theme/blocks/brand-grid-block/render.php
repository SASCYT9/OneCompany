<?php
/**
 * Brand Grid Block - Render Callback.
 *
 * @param   array    $attributes The block attributes.
 * @param   string   $content    The block content.
 * @param   WP_Block $block      The block object.
 *
 * @package OneCompany
 */

$num_posts = isset($attributes['numberOfPosts']) ? intval($attributes['numberOfPosts']) : 6;
$category_id = isset($attributes['selectedCategory']) ? $attributes['selectedCategory'] : '';

$args = array(
    'post_type'      => 'brand',
    'posts_per_page' => $num_posts,
    'post_status'    => 'publish',
);

if (!empty($category_id)) {
    $args['tax_query'] = array(
        array(
            'taxonomy' => 'brand_category',
            'field'    => 'id',
            'terms'    => $category_id,
        ),
    );
}

$brands_query = new WP_Query($args);

if ($brands_query->have_posts()) : ?>
    <div <?php echo get_block_wrapper_attributes(['class' => 'brand-grid-container container']); ?>>
        <div class="brand-grid">
            <?php
            while ($brands_query->have_posts()) :
                $brands_query->the_post();
                $color = get_post_meta(get_the_ID(), '_brand_color', true) ?: '#333';
                ?>
                <a href="<?php the_permalink(); ?>" class="brand-card-link">
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
        </div>
    </div>
<?php else : ?>
    <p>Брендів не знайдено.</p>
<?php endif;

wp_reset_postdata();
