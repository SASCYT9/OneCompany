import { registerBlockType } from '@wordpress/blocks';
import { RichText, InspectorControls, URLInput } from '@wordpress/block-editor';
import { PanelBody, TextControl } from '@wordpress/components';
import metadata from './block.json';

registerBlockType( metadata.name, {
    edit: ( { attributes, setAttributes } ) => {
        const { title, text, buttonText, buttonUrl } = attributes;

        return (
            <>
                <InspectorControls>
                    <PanelBody title="Button Settings">
                        <TextControl
                            label="Button Text"
                            value={ buttonText }
                            onChange={ ( val ) => setAttributes( { buttonText: val } ) }
                        />
                        <URLInput
                            label="Button URL"
                            value={ buttonUrl }
                            onChange={ ( url, post ) => setAttributes( { buttonUrl: url } ) }
                        />
                    </PanelBody>
                </InspectorControls>
                <div className="wp-block-onecompany-call-to-action">
                    <RichText
                        tagName="h2"
                        placeholder="Enter title..."
                        value={ title }
                        onChange={ ( val ) => setAttributes( { title: val } ) }
                    />
                    <RichText
                        tagName="p"
                        placeholder="Enter text..."
                        value={ text }
                        onChange={ ( val ) => setAttributes( { text: val } ) }
                    />
                    <div className="wp-block-button">
                        <a href="#" className="wp-block-button__link">
                            { buttonText }
                        </a>
                    </div>
                </div>
            </>
        );
    },
    save: ( { attributes } ) => {
        const { title, text, buttonText, buttonUrl } = attributes;

        return (
            <div className="wp-block-onecompany-call-to-action">
                <RichText.Content tagName="h2" value={ title } />
                <RichText.Content tagName="p" value={ text } />
                { buttonText && buttonUrl && (
                    <div className="wp-block-button">
                        <a href={ buttonUrl } className="wp-block-button__link">
                            { buttonText }
                        </a>
                    </div>
                ) }
            </div>
        );
    },
} );
