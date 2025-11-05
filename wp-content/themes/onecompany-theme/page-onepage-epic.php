<?php
/**
 * Template Name: One Page EPIC Template
 */
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo( 'charset' ); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>

<!-- Preloader -->
<div class="epic-preloader">
    <div class="epic-preloader__logo"><?php bloginfo('name'); ?></div>
    <div class="epic-preloader__bar">
        <div class="epic-preloader__progress"></div>
    </div>
    <div class="epic-preloader__percent">0%</div>
</div>

<!-- Custom Cursor -->
<div class="epic-cursor"></div>
<div class="epic-cursor-ring"></div>
<div class="nav-tooltip">Tooltip</div>

<!-- Navigation -->
<nav class="epic-nav">
    <a href="<?php echo home_url(); ?>" class="epic-nav__logo">
        <?php bloginfo('name'); ?>
    </a>
    
    <ul class="epic-nav__menu">
        <li><a href="#intro">Home</a></li>
        <li><a href="#brands">Бренди</a></li>
        <li><a href="#about">Про нас</a></li>
        <li><a href="#contact">Контакти</a></li>
    </ul>
    
    <div class="epic-nav__social">
        <a href="https://www.instagram.com/onecompany" target="_blank" title="Instagram">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
        </a>
        <a href="https://www.facebook.com/onecompany" target="_blank" title="Facebook">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/>
            </svg>
        </a>
        <a href="https://www.youtube.com/@onecompany" target="_blank" title="YouTube">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
            </svg>
        </a>
        <a href="tel:+380123456789" title="Phone">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 22.621l-3.521-6.795c-.008.004-1.974.97-2.064 1.011-2.24 1.086-6.799-7.82-4.609-8.994l2.083-1.026-3.493-6.817-2.106 1.039c-7.202 3.755 4.233 25.982 11.6 22.615.121-.055 2.102-1.029 2.11-1.033z"/>
            </svg>
        </a>
    </div>
    
    <div class="epic-nav__toggle">
        <span></span>
        <span></span>
        <span></span>
    </div>
</nav>

<!-- Progress Bar -->
<div class="progress-bar">
    <div class="progress-bar__fill"></div>
</div>

<!-- Slide Counter -->
<div class="slide-counter">
    <div class="slide-counter__current">01</div>
    <div class="slide-counter__divider"></div>
    <div class="slide-counter__total">
        <?php 
        $brands = new WP_Query(array('post_type' => 'brand', 'posts_per_page' => -1));
        $total = $brands->found_posts + 1;
        echo $total < 10 ? '0' . $total : $total;
        ?>
    </div>
</div>

<!-- Navigation Dots -->
<div class="nav-dots">
    <div class="nav-dot active" data-slide="0" data-title="INTRO"></div>
    <?php 
    $brands->rewind_posts();
    $dot_index = 1;
    while ($brands->have_posts()) : $brands->the_post();
        ?>
        <div class="nav-dot" data-slide="<?php echo $dot_index; ?>" data-title="<?php echo esc_attr(get_the_title()); ?>"></div>
        <?php
        $dot_index++;
    endwhile;
    wp_reset_postdata();
    ?>
</div>

<!-- Sound Toggle -->
<div class="sound-toggle muted" title="Toggle Sound">
    <div class="sound-toggle__icon icon-sound-on">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M5 17h-2v-10h2v10zm4-10v10l9-5-9-5zm11.086 2.914c.082.213.13.438.13.672 0 2.309-1.455 4.285-3.535 5.166l-.681-1.885c1.331-.703 2.216-2.094 2.216-3.567 0-.15-.018-.295-.048-.435l.918-1.956zm-1.899-2.115c.532.893.856 1.944.856 3.087 0 3.51-2.373 6.44-5.599 7.428l-.68-1.884c2.443-.842 4.279-3.231 4.279-5.835 0-.743-.16-1.447-.442-2.091l2.186-1.605zm.813-2.399c.791 1.259 1.25 2.723 1.25 4.305 0 4.63-3.298 8.525-7.5 9.689l-.68-1.884c3.421-1.028 6.18-4.08 6.18-7.991 0-1.168-.291-2.268-.813-3.268l2.243-1.641z"/>
        </svg>
    </div>
    <div class="sound-toggle__icon icon-sound-off">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M5 17h-2v-10h2v10zm4-10v10l9-5-9-5zm12.339 1.486l-1.061-1.061-1.215 1.215-.707-.707 1.215-1.215-1.061-1.061-.707.707 1.061 1.061-1.215 1.215.707.707 1.215-1.215 1.061 1.061.707-.707-1.061-1.061 1.215-1.215-.707-.707-1.215 1.215z"/>
        </svg>
    </div>
</div>

<!-- Slides Wrapper -->
<div class="epic-slides-wrapper">

    <!-- Epic Intro -->
    <div class="epic-intro" data-slide-index="0">
        <video 
            class="epic-intro__video"
            autoplay
            muted 
            loop 
            playsinline
            preload="auto"
        >
            <source src="<?php echo get_template_directory_uri(); ?>/videos/hero-smoke.mp4" type="video/mp4">
        </video>

        <div class="epic-intro__overlay"></div>
        <div class="epic-intro__grain"></div>
        <canvas class="epic-intro__particles"></canvas>
        
        <div class="epic-intro__content">
            <div class="epic-intro__label">THE ART OF AUTOMOTIVE</div>
            
            <h1 class="epic-intro__title">
                <div class="epic-intro__title-word">ONE</div>
                <div class="epic-intro__title-word">COMPANY</div>
            </h1>
            
            <div class="epic-intro__subtitle">ПРЕМІУМ АВТОМОБІЛЬНІ АКСЕСУАРИ</div>
            
            <div class="epic-intro__stats">
                <div class="epic-stat" data-count="500">
                    <span class="epic-stat__number">0</span>
                    <span class="epic-stat__label">ПРОЕКТІВ</span>
                </div>
                <div class="epic-stat" data-count="10">
                    <span class="epic-stat__number">0</span>
                    <span class="epic-stat__label">РОКІВ ДОСВІДУ</span>
                </div>
                <div class="epic-stat" data-count="50">
                    <span class="epic-stat__number">0</span>
                    <span class="epic-stat__label">КРАЇН</span>
                </div>
            </div>
        </div>

        <div class="epic-intro__scroll">
            <div class="epic-intro__scroll-text">DISCOVER</div>
            <div class="epic-intro__scroll-line">
                <div class="epic-intro__scroll-dot"></div>
            </div>
        </div>
    </div>

    <!-- Brand Slides -->
    <?php
    $brands->rewind_posts();
    $slide_index = 1;
    while ($brands->have_posts()) : $brands->the_post();
        $subtitle = get_post_meta(get_the_ID(), '_brand_subtitle', true);
        $video_url = get_post_meta(get_the_ID(), '_brand_video', true);
        $color = get_post_meta(get_the_ID(), '_brand_color', true);
        $features = get_post_meta(get_the_ID(), '_brand_features', true);
        $features_array = $features ? explode(',', $features) : array();
        
        if (!$color) $color = '#ff6b00';
        ?>
        <div class="epic-slide" data-slide-index="<?php echo $slide_index; ?>" data-accent="<?php echo esc_attr($color); ?>">
            <?php if ($video_url) : ?>
                <video 
                    class="epic-slide__video"
                    muted 
                    loop 
                    playsinline
                    preload="auto"
                >
                    <source src="<?php echo esc_url($video_url); ?>" type="video/mp4">
                </video>
            <?php endif; ?>

            <div class="epic-slide__overlay"></div>
            <div class="epic-slide__grain"></div>

            <div class="epic-slide__content">
                <div class="epic-slide__number">
                    <?php 
                    echo $slide_index < 9 ? '0' . ($slide_index + 1) : ($slide_index + 1); 
                    echo ' / ';
                    echo $total < 10 ? '0' . $total : $total;
                    ?>
                </div>
                
                <h2 class="epic-slide__title"><?php the_title(); ?></h2>
                
                <div class="epic-slide__divider"></div>
                
                <?php if ($subtitle) : ?>
                    <p class="epic-slide__description"><?php echo esc_html($subtitle); ?></p>
                <?php endif; ?>
                
                <?php if (!empty($features_array)) : ?>
                    <div class="epic-slide__features" style="margin-top: 30px;">
                        <?php foreach ($features_array as $feature) : ?>
                            <span style="display: inline-block; padding: 8px 16px; background: rgba(255,255,255,0.1); border-radius: 20px; margin-right: 10px; margin-bottom: 10px; font-size: 12px; letter-spacing: 1px;">
                                <?php echo esc_html(trim($feature)); ?>
                            </span>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            </div>
        </div>
        <?php
        $slide_index++;
    endwhile;
    wp_reset_postdata();
    ?>

</div> <!-- .epic-slides-wrapper -->

<!-- Epic Footer -->
<footer class="epic-footer">
    <div class="epic-footer__content">
        <div class="epic-footer__brand">
            <h3><?php bloginfo('name'); ?></h3>
            <p>Ми спеціалізуємося на преміальних автомобільних аксесуарах та тюнінгу. KW, Fi Exhaust, Eventuri - тільки найкраще для вашого автомобіля.</p>
            <div class="epic-footer__social">
                <a href="https://www.instagram.com/onecompany" target="_blank">
                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </a>
                <a href="https://www.facebook.com/onecompany" target="_blank">
                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>
                </a>
                <a href="https://www.youtube.com/@onecompany" target="_blank">
                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                </a>
            </div>
        </div>
        
        <div class="epic-footer__section">
            <h4>Бренди</h4>
            <ul>
                <li><a href="#kw">KW Suspension</a></li>
                <li><a href="#fi">Fi Exhaust</a></li>
                <li><a href="#eventuri">Eventuri Intakes</a></li>
            </ul>
        </div>
        
        <div class="epic-footer__section">
            <h4>Компанія</h4>
            <ul>
                <li><a href="#about">Про нас</a></li>
                <li><a href="#portfolio">Портфоліо</a></li>
                <li><a href="#contact">Контакти</a></li>
            </ul>
        </div>
        
        <div class="epic-footer__section">
            <h4>Контакти</h4>
            <ul>
                <li><a href="tel:+380123456789">+38 (012) 345-67-89</a></li>
                <li><a href="mailto:info@onecompany.com">info@onecompany.com</a></li>
                <li><a href="#">Україна, Київ</a></li>
            </ul>
        </div>
    </div>
    
    <div class="epic-footer__bottom">
        &copy; <?php echo date('Y'); ?> <?php bloginfo('name'); ?>. All rights reserved. Designed with passion.
    </div>
</footer>

<?php wp_footer(); ?>
</body>
</html>
