<?php
/**
 * Plugin Name: Call to Action Block
 * Description: A block to create a call to action section.
 * Version: 1.0.0
 * Author: Jules
 */

if (!defined('ABSPATH')) {
    exit;
}

function register_call_to_action_block() {
    register_block_type_from_metadata(__DIR__);
}
add_action('init', 'register_call_to_action_block');
