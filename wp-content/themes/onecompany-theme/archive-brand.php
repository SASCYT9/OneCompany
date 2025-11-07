<?php
/**
 * The template for displaying Brand archives
 *
 * @link https://developer.wordpress.org/themes/basics/template-hierarchy/
 *
 * @package OneCompany
 */

get_header();
?>

	<main id="primary" class="site-main">

		<header class="page-header">
			<div class="page-header__inner">
				<?php
				the_archive_title( '<h1 class="page-title">', '</h1>' );
				the_archive_description( '<div class="archive-description">', '</div>' );
				?>
			</div>
		</header>

		<?php if ( have_posts() ) : ?>
			<div class="brands-archive-grid">
				<?php
				/* Start the Loop */
				while ( have_posts() ) :
					the_post();
					get_template_part( 'template-parts/content', 'brand' );
				endwhile;
				?>
			</div>
			<?php
			the_posts_navigation();
		else :
			get_template_part( 'template-parts/content', 'none' );
		endif;
		?>

	</main><!-- #main -->

<?php
get_footer();
