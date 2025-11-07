<?php
/**
 * Template part for displaying brand posts
 *
 * @link https://developer.wordpress.org/themes/basics/template-hierarchy/
 *
 * @package OneCompany
 */

// Get brand fields using standard WordPress functions
$brand_logo_id = get_post_meta(get_the_ID(), '_brand_logo_id', true);
$brand_logo_url = $brand_logo_id ? wp_get_attachment_image_url($brand_logo_id, 'medium') : '';
$brand_hero_image_url = get_the_post_thumbnail_url(get_the_ID(), 'large');
$brand_country = get_post_meta(get_the_ID(), '_brand_subtitle', true); // Assuming subtitle is country
$brand_tags_str = get_post_meta(get_the_ID(), '_brand_features', true);
$brand_tags = !empty($brand_tags_str) ? explode(',', $brand_tags_str) : array();

// Fallback to a placeholder if no hero image is set
$style_attribute = $brand_hero_image_url ? 'style="--brand-image: url(' . esc_url($brand_hero_image_url) . ')"' : '';
$touch_class = wp_is_mobile() ? 'brand-card--touch' : '';
?>

<article id="post-<?php the_ID(); ?>" <?php post_class( "brand-card " . esc_attr($touch_class) ); ?> <?php echo $style_attribute; ?>>
	<a href="<?php the_permalink(); ?>" class="brand-card__link-overlay"><span class="screen-reader-text"><?php the_title(); ?></span></a>
	<div class="brand-card__content">
		<div class="brand-card__meta">
			<?php if ($brand_logo_url): ?>
				<div class="brand-card__logo">
					<img src="<?php echo esc_url($brand_logo_url); ?>" alt="<?php the_title_attribute(); ?> Logo" />
				</div>
			<?php endif; ?>
			<h2 class="brand-card__title"><?php the_title(); ?></h2>
		</div>
		<div class="brand-card__subtitle"><?php echo esc_html( $brand_country ); ?></div>
		<?php if ($brand_tags): ?>
			<div class="brand-card__tags">
				<?php foreach($brand_tags as $tag): ?>
					<span class="brand-card__tag"><?php echo esc_html($tag); ?></span>
				<?php endforeach; ?>
			</div>
		<?php endif; ?>
		<div class="brand-card__cta">
			<span><?php _e('View Details', 'onecompany'); ?></span>
		</div>
	</div>
</article>
