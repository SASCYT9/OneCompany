<?php
function onecompany_register_block_patterns() {
    register_block_pattern(
        'onecompany/key-features',
        array(
            'title'       => __( 'Key Features', 'onecompany' ),
            'description' => _x( 'A section with a heading and a preformatted block for technical specifications.', 'Block pattern description', 'onecompany' ),
            'categories'  => array( 'onecompany' ),
            'content'     => '<!-- wp:group {"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)"><!-- wp:heading -->
<h2 class="wp-block-heading">' . esc_html__( 'Technical Specifications', 'onecompany' ) . '</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>' . esc_html__( 'Detailed specifications for the tuning package:', 'onecompany' ) . '</p>
<!-- /wp:paragraph -->

<!-- wp:preformatted -->
<pre class="wp-block-preformatted"><code>' . esc_html( "Engine: 4.0L V8 Bi-Turbo\nPower: 800 HP\nTorque: 1000 Nm\n0-100 km/h: 3.1s\nTop Speed: 340 km/h" ) . '</code></pre>
<!-- /wp:preformatted --></div>
<!-- /wp:group -->',
        )
    );

    register_block_pattern(
        'onecompany/homepage',
        array(
            'title'       => __( 'Homepage', 'onecompany' ),
            'description' => _x( 'A full homepage layout with a hero, brand grid, FAQ accordion, and more.', 'Block pattern description', 'onecompany' ),
            'categories'  => array( 'onecompany' ),
            'content'     => '<!-- wp:onecompany/hero {"mediaType":"video","videoUrl":"' . esc_url( get_template_directory_uri() . '/assets/videos/hero-video.mp4' ) . '","eyebrow":"THE ART OF AUTOMOTIVE","title":"ONE COMPANY","subtitle":"ПРЕМІУМ АВТОМОБІЛЬНІ АКСЕСУАРИ"} -->
<!-- /wp:onecompany/hero -->

<!-- wp:onecompany/brand-grid /-->

<!-- wp:group {"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|70","bottom":"var:preset|spacing|70"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull" style="padding-top:var(--wp--preset--spacing--70);padding-bottom:var(--wp--preset--spacing--70)"><!-- wp:heading {"textAlign":"center"} -->
<h2 class="wp-block-heading has-text-align-center">' . esc_html__( 'Frequently Asked Questions', 'onecompany' ) . '</h2>
<!-- /wp:heading -->

<!-- wp:onecompany/accordion {"title":"Як довго триває стандартний тюнінг-проект?"} -->
<!-- wp:paragraph -->
<p>Терміни виконання проекту залежать від складності робіт. В середньому, стандартний тюнінг займає від 2 до 4 тижнів. Ми надаємо детальний план робіт після консультації.</p>
<!-- /wp:paragraph -->
<!-- /wp:onecompany/accordion -->

<!-- wp:onecompany/accordion {"title":"Чи надаєте ви гарантію на виконані роботи?"} -->
<!-- wp:paragraph -->
<p>Так, ми надаємо офіційну гарантію на всі виконані роботи та встановлені компоненти. Термін гарантії залежить від типу послуги та виробника запчастин.</p>
<!-- /wp:paragraph -->
<!-- /wp:onecompany/accordion -->

<!-- wp:onecompany/accordion {"title":"З якими марками автомобілів ви працюєте?"} -->
<!-- wp:paragraph -->
<p>Ми спеціалізуємося на преміум-брендах, таких як BMW, Mercedes-Benz, Audi, Porsche, Lamborghini, Ferrari та інші. Зв\'яжіться з нами для уточнення можливості роботи з вашим автомобілем.</p>
<!-- /wp:paragraph -->
<!-- /wp:onecompany/accordion --></div>
<!-- /wp:group -->

<!-- wp:onecompany/image-compare /-->',
        )
    );

    register_block_pattern(
        'onecompany/about-us',
        array(
            'title'       => __( 'About Us Page', 'onecompany' ),
            'description' => _x( 'A layout for an About Us page, including mission, team, and gallery sections.', 'Block pattern description', 'onecompany' ),
            'categories'  => array( 'onecompany' ),
            'content'     => '<!-- wp:group {"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|70","bottom":"var:preset|spacing|70"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull" style="padding-top:var(--wp--preset--spacing--70);padding-bottom:var(--wp--preset--spacing--70)"><!-- wp:columns -->
<div class="wp-block-columns"><!-- wp:column {"width":"33.33%"} -->
<div class="wp-block-column" style="flex-basis:33.33%"><!-- wp:heading -->
<h2 class="wp-block-heading">' . esc_html__( 'Our Mission', 'onecompany' ) . '</h2>
<!-- /wp:heading --></div>
<!-- /wp:column -->

<!-- wp:column {"width":"66.66%"} -->
<div class="wp-block-column" style="flex-basis:66.66%"><!-- wp:paragraph {"style":{"fontSize":"large"}} -->
<p class="has-large-font-size">' . esc_html__( 'To provide automotive enthusiasts with the highest quality tuning parts and services, combining our passion for performance with cutting-edge technology and unparalleled customer support.', 'onecompany' ) . '</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column --></div>
<!-- /wp:columns --></div>
<!-- /wp:group -->

<!-- wp:group {"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|70","bottom":"var:preset|spacing|70"}}},"backgroundColor":"surface-light","layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull has-surface-light-background-color has-background" style="padding-top:var(--wp--preset--spacing--70);padding-bottom:var(--wp--preset--spacing--70)"><!-- wp:heading {"textAlign":"center"} -->
<h2 class="wp-block-heading has-text-align-center">' . esc_html__( 'Meet The Team', 'onecompany' ) . '</h2>
<!-- /wp:heading -->

<!-- wp:columns {"style":{"spacing":{"blockGap":{"top":"var:preset|spacing|50","left":"var:preset|spacing|50"}}}} -->
<div class="wp-block-columns"><!-- wp:column {"verticalAlignment":"center"} -->
<div class="wp-block-column is-vertically-aligned-center"><!-- wp:image {"align":"center","width":150,"height":150,"sizeSlug":"full","linkDestination":"none","style":{"border":{"radius":"50%"}}} -->
<figure class="wp-block-image aligncenter size-full is-resized has-custom-border"><img src="' . esc_url( get_template_directory_uri() . '/assets/images/team1.jpg' ) . '" alt="" style="border-radius:50%;" width="150" height="150"/></figure>
<!-- /wp:image -->

<!-- wp:heading {"textAlign":"center","level":4} -->
<h4 class="wp-block-heading has-text-align-center">' . esc_html__( 'John Doe', 'onecompany' ) . '</h4>
<!-- /wp:heading -->

<!-- wp:paragraph {"textAlign":"center","textColor":"text-muted"} -->
<p class="has-text-align-center has-text-muted-color has-text-color">' . esc_html__( 'Founder & CEO', 'onecompany' ) . '</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column -->

<!-- wp:column {"verticalAlignment":"center"} -->
<div class="wp-block-column is-vertically-aligned-center"><!-- wp:image {"align":"center","width":150,"height":150,"sizeSlug":"full","linkDestination":"none","style":{"border":{"radius":"50%"}}} -->
<figure class="wp-block-image aligncenter size-full is-resized has-custom-border"><img src="' . esc_url( get_template_directory_uri() . '/assets/images/team2.jpg' ) . '" alt="" style="border-radius:50%;" width="150" height="150"/></figure>
<!-- /wp:image -->

<!-- wp:heading {"textAlign":"center","level":4} -->
<h4 class="wp-block-heading has-text-align-center">' . esc_html__( 'Jane Smith', 'onecompany' ) . '</h4>
<!-- /wp:heading -->

<!-- wp:paragraph {"textAlign":"center","textColor":"text-muted"} -->
<p class="has-text-align-center has-text-muted-color has-text-color">' . esc_html__( 'Lead Technician', 'onecompany' ) . '</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column -->

<!-- wp:column {"verticalAlignment":"center"} -->
<div class="wp-block-column is-vertically-aligned-center"><!-- wp:image {"align":"center","width":150,"height":150,"sizeSlug":"full","linkDestination":"none","style":{"border":{"radius":"50%"}}} -->
<figure class="wp-block-image aligncenter size-full is-resized has-custom-border"><img src="' . esc_url( get_template_directory_uri() . '/assets/images/team3.jpg' ) . '" alt="" style="border-radius:50%;" width="150" height="150"/></figure>
<!-- /wp:image -->

<!-- wp:heading {"textAlign":"center","level":4} -->
<h4 class="wp-block-heading has-text-align-center">' . esc_html__( 'Mike Johnson', 'onecompany' ) . '</h4>
<!-- /wp:heading -->

<!-- wp:paragraph {"textAlign":"center","textColor":"text-muted"} -->
<p class="has-text-align-center has-text-muted-color has-text-color">' . esc_html__( 'Sales Manager', 'onecompany' ) . '</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column --></div>
<!-- /wp:columns --></div>
<!-- /wp:group -->

<!-- wp:onecompany/gallery /-->',
        )
    );

    register_block_pattern(
        'onecompany/services-page',
        array(
            'title'       => __( 'Services Page', 'onecompany' ),
            'description' => _x( 'A layout for a Services page, using tabs for categories and accordions for details.', 'Block pattern description', 'onecompany' ),
            'categories'  => array( 'onecompany' ),
            'content'     => '<!-- wp:group {"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|70","bottom":"var:preset|spacing|70"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull" style="padding-top:var(--wp--preset--spacing--70);padding-bottom:var(--wp--preset--spacing--70)"><!-- wp:heading {"textAlign":"center"} -->
<h2 class="wp-block-heading has-text-align-center">' . esc_html__( 'Our Services', 'onecompany' ) . '</h2>
<!-- /wp:heading -->

<!-- wp:paragraph {"textAlign":"center"} -->
<p class="has-text-align-center">' . esc_html__( 'We offer a wide range of tuning services to meet your needs.', 'onecompany' ) . '</p>
<!-- /wp:paragraph -->

<!-- wp:onecompany/tabs {"tabTitles":["Engine","Suspension","Brakes"]} -->
<!-- wp:paragraph -->
<p>' . esc_html__( 'Engine tuning services.', 'onecompany' ) . '</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>' . esc_html__( 'Suspension tuning services.', 'onecompany' ) . '</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>' . esc_html__( 'Brake tuning services.', 'onecompany' ) . '</p>
<!-- /wp:paragraph -->
<!-- /wp:onecompany/tabs --></div>
<!-- /wp:group -->',
        )
    );

    register_block_pattern(
        'onecompany/cta-section',
        array(
            'title'       => __( 'Call to Action Section', 'onecompany' ),
            'description' => _x( 'A section with a call to action block.', 'Block pattern description', 'onecompany' ),
            'categories'  => array( 'onecompany' ),
            'content'     => '<!-- wp:group {"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|70","bottom":"var:preset|spacing|70"}}},"backgroundColor":"surface-light","layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull has-surface-light-background-color has-background" style="padding-top:var(--wp--preset--spacing--70);padding-bottom:var(--wp--preset--spacing--70)"><!-- wp:onecompany/call-to-action {"title":"' . esc_html__( 'Ready to Upgrade?', 'onecompany' ) . '","text":"' . esc_html__( 'Contact us today to discuss your project and get a free quote.', 'onecompany' ) . '","buttonText":"' . esc_html__( 'Get in Touch', 'onecompany' ) . '","buttonUrl":"/contact"} /--></div>
<!-- /wp:group -->',
        )
    );

    register_block_pattern(
        'onecompany/testimonials-section',
        array(
            'title'       => __( 'Testimonials Section', 'onecompany' ),
            'description' => _x( 'A section with a couple of testimonials.', 'Block pattern description', 'onecompany' ),
            'categories'  => array( 'onecompany' ),
            'content'     => '<!-- wp:group {"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|70","bottom":"var:preset|spacing|70"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull" style="padding-top:var(--wp--preset--spacing--70);padding-bottom:var(--wp--preset--spacing--70)"><!-- wp:heading {"textAlign":"center"} -->
<h2 class="wp-block-heading has-text-align-center">' . esc_html__( 'What Our Clients Say', 'onecompany' ) . '</h2>
<!-- /wp:heading -->

<!-- wp:columns -->
<div class="wp-block-columns"><!-- wp:column -->
<div class="wp-block-column"><!-- wp:onecompany/testimonials {"text":"' . esc_html__( 'The team at OneCompany transformed my car. The performance is incredible, and the service was top-notch.', 'onecompany' ) . '","author":"' . esc_html__( 'John D.', 'onecompany' ) . '","imageUrl":"' . esc_url( get_template_directory_uri() . '/assets/images/team1.jpg' ) . '"} /--></div>
<!-- /wp:column -->

<!-- wp:column -->
<div class="wp-block-column"><!-- wp:onecompany/testimonials {"text":"' . esc_html__( 'I couldn\'t be happier with the results. My car is now a true masterpiece, thanks to the skilled technicians at OneCompany.', 'onecompany' ) . '","author":"' . esc_html__( 'Jane S.', 'onecompany' ) . '","imageUrl":"' . esc_url( get_template_directory_uri() . '/assets/images/team2.jpg' ) . '"} /--></div>
<!-- /wp:column --></div>
<!-- /wp:columns --></div>
<!-- /wp:group -->',
        )
    );
}
add_action( 'init', 'onecompany_register_block_patterns' );

function onecompany_register_block_pattern_category() {
    register_block_pattern_category(
        'onecompany',
        array( 'label' => __( 'OneCompany', 'onecompany' ) )
    );
}
add_action( 'init', 'onecompany_register_block_pattern_category' );
