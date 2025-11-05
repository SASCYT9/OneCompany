/**
 * File for live previewing of the Customizer.
 *
 * @package OneCompany
 */
( function( $ ) {
    'use strict';

    // Hero Title
    wp.customize( 'onecompany_hero_title', function( value ) {
        value.bind( function( to ) {
            $( '.hero-title' ).text( to );
        } );
    } );

    // Hero Subtitle
    wp.customize( 'onecompany_hero_subtitle', function( value ) {
        value.bind( function( to ) {
            $( '.hero-subtitle' ).text( to );
        } );
    } );

} )( jQuery );
