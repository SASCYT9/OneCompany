<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="<?php bloginfo('description'); ?>">
    <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
    <?php wp_body_open(); ?>

    <header class="site-header">
        <nav id="mainNav" class="site-navigation">
            <div class="site-navigation__inner">
                <a href="<?php echo esc_url(home_url('/')); ?>" class="site-navigation__logo">
                    <?php
                    if (has_custom_logo()) {
                        the_custom_logo();
                    } else {
                        echo esc_html(get_bloginfo('name'));
                    }
                    ?>
                </a>

                <?php if (has_nav_menu('primary')) : ?>
                    <?php
                    wp_nav_menu(array(
                        'theme_location' => 'primary',
                        'menu_class'     => 'site-navigation__menu',
                        'container'      => false,
                        'depth'          => 1,
                    ));
                    ?>
                <?php else : ?>
                    <ul class="site-navigation__menu">
                        <?php
                        wp_list_pages(array(
                            'title_li' => '',
                            'depth'    => 1,
                        ));
                        ?>
                    </ul>
                <?php endif; ?>
            </div>
        </nav>
    </header>

