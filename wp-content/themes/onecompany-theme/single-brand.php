<?php
/**
 * The template for displaying a single brand post type.
 *
 * @package OneCompany
 */

get_header();

while (have_posts()) :
    the_post();

    // Get brand metadata
    $post_id = get_the_ID();
    $subtitle = get_post_meta($post_id, '_brand_subtitle', true);
    $video_url = get_post_meta($post_id, '_brand_video', true);
    $poster_id = get_post_meta($post_id, '_brand_poster_id', true);
    $poster_url = $poster_id ? wp_get_attachment_image_url($poster_id, 'full') : get_the_post_thumbnail_url($post_id, 'full');
    $features = get_post_meta($post_id, '_brand_features', true);
    $features_list = !empty($features) ? array_map('trim', explode(',', $features)) : [];

    // --- Hero Section ---
    $hero_content = sprintf(
        '<!-- wp:onecompany/hero-block {"eyebrow":"%s","title":"%s","subtitle":"%s","mediaUrl":"%s"} /-->',
        esc_html($subtitle),
        esc_html(get_the_title()),
        '', // Subtitle is empty in this context, main content is below
        esc_url($video_url)
    );
    echo do_blocks($hero_content);

    // --- Main Content Section ---
    ?>
    <section class="wp-block-group" style="padding-top: var(--spacing-section); padding-bottom: var(--spacing-section);">
        <div class="wp-block-group__inner-container" style="max-width: var(--max-width-default); margin: auto;">

            <!-- Main Description -->
            <div class="brand-content-wrapper">
                <?php the_content(); ?>
            </div>

            <?php if (!empty($features_list)) : ?>
            <!-- Features Section -->
            <div style="margin-top: 4rem; margin-bottom: 4rem;">
                <?php
                $features_block_content = '<!-- wp:onecompany/section-header-block {"eyebrow":"Ключові особливості","title":"Чому обирають ' . esc_html(get_the_title()) . '"} /-->';
                echo do_blocks($features_block_content);
                ?>
                <div class="features-grid">
                    <?php foreach ($features_list as $feature) : ?>
                        <div class="feature-item">
                            <span class="feature-item__icon">✓</span>
                            <h4 class="feature-item__title"><?php echo esc_html($feature); ?></h4>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
            <?php endif; ?>

        </div>
    </section>
    <?php

    // --- Gallery Section ---
    // For demonstration, we'll create a gallery block with placeholder images.
    // In a real scenario, you might pull images from a custom field.
    $gallery_content = '
    <!-- wp:onecompany/section-header-block {"eyebrow":"Наші роботи","title":"Галерея проектів"} /-->
    <!-- wp:onecompany/gallery-block {"galleryType":"grid","columnsDesktop":2,"mediaItems":[
        {"id":1,"url":"/wp-content/uploads/images/gallery-1.jpg","type":"image"},
        {"id":2,"url":"/wp-content/uploads/images/gallery-2.jpg","type":"image"},
        {"id":3,"url":"/wp-content/uploads/images/gallery-3.jpg","type":"image"},
        {"id":4,"url":"/wp-content/uploads/images/gallery-4.jpg","type":"image"}
    ]} /-->';
    echo do_blocks($gallery_content);

endwhile;

get_footer();
