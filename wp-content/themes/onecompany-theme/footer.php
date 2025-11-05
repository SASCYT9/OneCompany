        <footer class="site-footer">
            <div class="footer-container">
                <div class="footer-brand">
                    <h3><?php bloginfo('name'); ?></h3>
                    <p><?php echo esc_html(get_bloginfo('description', 'display')); ?></p>
                </div>

                <div class="footer-menu">
                    <?php if (has_nav_menu('primary')) : ?>
                        <?php
                        wp_nav_menu(array(
                            'theme_location' => 'primary',
                            'menu_class'     => 'footer-links',
                            'container'      => false,
                            'depth'          => 1,
                        ));
                        ?>
                    <?php endif; ?>
                </div>

                <div class="footer-contact">
                    <?php if ($phone = get_theme_mod('footer_phone', '+38 (012) 345-67-89')) : ?>
                        <a href="tel:<?php echo esc_attr(preg_replace('/\D+/', '', $phone)); ?>" class="footer-link"><?php echo esc_html($phone); ?></a>
                    <?php endif; ?>
                    <?php if ($email = get_theme_mod('footer_email', 'info@onecompany.com')) : ?>
                        <a href="mailto:<?php echo esc_attr($email); ?>" class="footer-link"><?php echo esc_html($email); ?></a>
                    <?php endif; ?>
                </div>
            </div>

            <div class="footer-bottom">
                <span>&copy; <?php echo date('Y'); ?> <?php bloginfo('name'); ?>. All rights reserved.</span>
            </div>
        </footer>

        <?php wp_footer(); ?>

</body>
</html>
