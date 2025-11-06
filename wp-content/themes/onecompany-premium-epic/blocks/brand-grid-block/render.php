<?php
/**
 * Brand Grid Block - Render Callback (Premium Update).
 *
 * @param   array    $attributes The block attributes.
 * @param   string   $content    The block content.
 * @param   WP_Block $block      The block object.
 *
 * @package OneCompany
 */

$num_posts = $attributes['numberOfPosts'] ?? 9;
$category_slug = $attributes['selectedCategory'] ?? '';

$args = [
    'post_type'      => 'brand',
    'posts_per_page' => $num_posts,
    'post_status'    => 'publish',
    'orderby'        => 'date',
    'order'          => 'DESC',
];

if (!empty($category_slug)) {
    $args['tax_query'] = [
        [
            'taxonomy' => 'brand_category',
            'field'    => 'slug',
            'terms'    => $category_slug,
        ],
    ];
}

$brands_query = new WP_Query($args);

if ($brands_query->have_posts()) : ?>
    <div <?php echo get_block_wrapper_attributes(['class' => 'brands-grid']); ?>>
        <?php
        while ($brands_query->have_posts()) :
            $brands_query->the_post();

            $post_id = get_the_ID();
            $brand_image_url = get_the_post_thumbnail_url($post_id, 'large');
            $brand_logo_id = get_post_meta($post_id, '_brand_logo_id', true);
            $brand_logo_url = $brand_logo_id ? wp_get_attachment_image_url($brand_logo_id, 'thumbnail') : '';
            $brand_subtitle = get_post_meta($post_id, '_brand_subtitle', true);
            $brand_tags = get_the_terms($post_id, 'brand_tag');
            ?>
            <a href="<?php the_permalink(); ?>" class="brand-card" style="<?php echo $brand_image_url ? '--brand-image: url(' . esc_url($brand_image_url) . ')' : ''; ?>">
                <div class="brand-card__content">
                    <div class="brand-card__meta">
                        <?php if ($brand_logo_url) : ?>
                            <div class="brand-card__logo">
                                <img src="<?php echo esc_url($brand_logo_url); ?>" alt="<?php the_title_attribute(); ?> Logo">
                            </div>
                        <?php endif; ?>
                        <h3 class="brand-card__title"><?php the_title(); ?></h3>
                    </div>

                    <?php if ($brand_subtitle) : ?>
                        <p class="brand-card__subtitle"><?php echo esc_html($brand_subtitle); ?></p>
                    <?php endif; ?>

                    <?php if (!empty($brand_tags) && !is_wp_error($brand_tags)) : ?>
                        <div class="brand-card__tags">
                            <?php foreach (array_slice($brand_tags, 0, 3) as $tag) : ?>
                                <span class="brand-card__tag"><?php echo esc_html($tag->name); ?></span>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>

                    <div class="brand-card__cta">
                        <?php _e('Дізнатись більше', 'onecompany-theme'); ?>
                    </div>
                </div>
            </a>
        <?php endwhile; ?>
    </div>
<?php else : ?>
    <p class="container"><?php _e('Наразі немає брендів для відображення.', 'onecompany-theme'); ?></p>
<?php endif;

wp_reset_postdata();
