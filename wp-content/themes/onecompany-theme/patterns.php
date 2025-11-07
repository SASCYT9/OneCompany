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
}
add_action( 'init', 'onecompany_register_block_patterns' );

function onecompany_register_block_pattern_category() {
    register_block_pattern_category(
        'onecompany',
        array( 'label' => __( 'OneCompany', 'onecompany' ) )
    );
}
add_action( 'init', 'onecompany_register_block_pattern_category' );
