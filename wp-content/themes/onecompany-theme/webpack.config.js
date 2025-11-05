const defaultConfig = require('@wordpress/scripts/config/webpack.config');
const path = require('path');

module.exports = {
    ...defaultConfig,
    entry: {
        'hero-block/index': './blocks/hero-block/index.js',
        'brand-slide/index': './blocks/brand-slide/index.js',
        'brand-grid-block/index': './blocks/brand-grid-block/index.js',
        'contact-form-block/index': './blocks/contact-form-block/index.js',
        'gallery-block/index': './blocks/gallery-block/index.js',
    },
    output: {
        path: path.resolve(__dirname, 'build'),
        filename: '[name].js',
    }
};
