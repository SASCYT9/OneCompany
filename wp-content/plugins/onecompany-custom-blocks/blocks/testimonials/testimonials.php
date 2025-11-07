<?php
/**
 * Plugin Name: Testimonials Block
 * Description: A block to display customer testimonials.
 * Version: 1.0.0
 * Author: Jules
 */

if (!defined('ABSPATH')) {
    exit;
}

function register_testimonials_block() {
    register_block_type_from_metadata(__DIR__);
}
add_action('init', 'register_testimonials_block');
