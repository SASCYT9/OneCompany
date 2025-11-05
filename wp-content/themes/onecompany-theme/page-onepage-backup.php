<?php
/**
 * Template Name: One Page
 * Description: One-page layout with video sections
 */

get_header();

// Get hero section content
$hero_title = get_option('onecompany_hero_title', 'onecompany');
$hero_subtitle = get_option('onecompany_hero_subtitle', 'Преміум автотюнінг. Три напрями. Одна філософія.');
$hero_video = get_option('onecompany_hero_video', '/wp-content/uploads/hero-smoke.mp4');

// Get all brands
$brands = new WP_Query(array(
    'post_type' => 'brand',
    'posts_per_page' => -1,
    'orderby' => 'menu_order',
    'order' => 'ASC'
));
?>

<!-- Hero Video Background -->
<div class="video-section" id="hero-video" style="opacity: 1;">
    <video autoplay loop muted playsinline>
        <source src="<?php echo esc_url($hero_video); ?>" type="video/mp4">
    </video>
    <div class="vignette"></div>
    <!-- Glow effects -->
    <div style="position: absolute; inset: 0; background: radial-gradient(ellipse 800px 400px at 30% 50%, rgba(255,107,0,0.15) 0%, transparent 60%); filter: blur(40px);"></div>
    <div style="position: absolute; inset: 0; background: radial-gradient(ellipse 800px 400px at 70% 50%, rgba(0,102,255,0.15) 0%, transparent 60%); filter: blur(40px);"></div>
</div>

<!-- Hero Section -->
<section class="hero-section">
    <div style="text-align: center; max-width: 80rem; margin: 0 auto;">
        <div style="position: relative;">
            <div style="position: absolute; inset: 0; filter: blur(3rem); opacity: 0.6; background: linear-gradient(90deg, #ff6b00 0%, transparent 30%, transparent 70%, #0066ff 100%); transform: scale(1.2);"></div>
            <h1 class="hero-title"><?php echo esc_html($hero_title); ?></h1>
        </div>
        <p class="hero-subtitle"><?php echo esc_html($hero_subtitle); ?></p>
    </div>
</section>

<!-- Brand Sections -->
<?php if ($brands->have_posts()) : $brand_index = 0; ?>
    <?php while ($brands->have_posts()) : $brands->the_post(); 
        $subtitle = get_post_meta(get_the_ID(), '_brand_subtitle', true);
        $video = get_post_meta(get_the_ID(), '_brand_video', true);
        $color = get_post_meta(get_the_ID(), '_brand_color', true);
        $features = get_post_meta(get_the_ID(), '_brand_features', true);
        $features_array = $features ? array_map('trim', explode(',', $features)) : array();
        $slug = get_post_field('post_name', get_the_ID());
        $brand_index++;
    ?>
    
    <!-- Video Background for <?php the_title(); ?> -->
    <div class="video-section" id="video-<?php echo esc_attr($slug); ?>" style="opacity: 0;" data-brand-index="<?php echo $brand_index; ?>">
        <?php if ($video) : ?>
            <video loop muted playsinline>
                <source src="<?php echo esc_url($video); ?>" type="video/mp4">
            </video>
        <?php endif; ?>
        <div class="vignette"></div>
        <div style="position: absolute; inset: 0; mix-blend-mode: overlay; background: radial-gradient(circle at 50% 50%, <?php echo esc_attr($color); ?>20 0%, transparent 70%);"></div>
    </div>
    
    <!-- Brand Section -->
    <section class="product-section" id="<?php echo esc_attr($slug); ?>">
        <div style="text-align: center; max-width: 60rem; margin: 0 auto;">
            <div class="glass-card" style="padding: 3rem 4rem; position: relative; overflow: hidden;">
                <div class="shimmer" style="position: absolute; inset: 0; border-radius: 2.5rem; opacity: 0.3; background: linear-gradient(135deg, transparent 40%, <?php echo esc_attr($color); ?>20 50%, transparent 60%);"></div>
                
                <div style="position: relative; z-index: 10;">
                    <h2 class="product-title <?php echo esc_attr($slug); ?>" style="color: <?php echo esc_attr($color); ?>; text-shadow: 0 0 60px <?php echo esc_attr($color); ?>60, 0 0 30px <?php echo esc_attr($color); ?>40;">
                        <?php the_title(); ?>
                    </h2>
                    
                    <?php if ($subtitle) : ?>
                        <p class="product-subtitle"><?php echo esc_html($subtitle); ?></p>
                    <?php endif; ?>
                    
                    <div class="product-description">
                        <?php the_content(); ?>
                    </div>
                    
                    <?php if (!empty($features_array)) : ?>
                        <div class="feature-pills">
                            <?php foreach ($features_array as $feature) : ?>
                                <span class="feature-pill"><?php echo esc_html($feature); ?></span>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                    
                    <a href="#contact" class="glass-button" style="box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.2), 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 40px <?php echo esc_attr($color); ?>30;">
                        Дізнатись більше
                    </a>
                </div>
            </div>
        </div>
    </section>
    
    <?php endwhile; wp_reset_postdata(); ?>
<?php endif; ?>

<?php get_footer(); ?>
