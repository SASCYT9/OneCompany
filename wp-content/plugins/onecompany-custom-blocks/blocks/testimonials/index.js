import { registerBlockType } from '@wordpress/blocks';
import { RichText, MediaUpload, InspectorControls } from '@wordpress/block-editor';
import { Button, PanelBody } from '@wordpress/components';
import metadata from './block.json';

registerBlockType( metadata.name, {
    edit: ( { attributes, setAttributes } ) => {
        const { text, author, imageUrl, imageId } = attributes;

        const onSelectImage = ( media ) => {
            setAttributes( {
                imageUrl: media.url,
                imageId: media.id,
            } );
        };

        const onRemoveImage = () => {
            setAttributes( {
                imageUrl: '',
                imageId: null,
            } );
        };

        return (
            <>
                <div className="wp-block-onecompany-testimonials">
                    { ! imageUrl ? (
                        <MediaUpload
                            onSelect={ onSelectImage }
                            allowedTypes={ [ 'image' ] }
                            value={ imageId }
                            render={ ( { open } ) => (
                                <Button onClick={ open } variant="primary">
                                    Choose Image
                                </Button>
                            ) }
                        />
                    ) : (
                        <div className="testimonial-image">
                            <img src={ imageUrl } alt="" />
                            <Button onClick={ onRemoveImage } isLink isDestructive>
                                Remove Image
                            </Button>
                        </div>
                    ) }
                    <RichText
                        tagName="blockquote"
                        placeholder="Enter testimonial text..."
                        value={ text }
                        onChange={ ( val ) => setAttributes( { text: val } ) }
                    />
                    <RichText
                        tagName="cite"
                        placeholder="Enter author's name..."
                        value={ author }
                        onChange={ ( val ) => setAttributes( { author: val } ) }
                    />
                </div>
            </>
        );
    },
    save: ( { attributes } ) => {
        const { text, author, imageUrl } = attributes;

        return (
            <div className="wp-block-onecompany-testimonials">
                { imageUrl && <img src={ imageUrl } alt={ author } /> }
                <RichText.Content tagName="blockquote" value={ text } />
                <RichText.Content tagName="cite" value={ author } />
            </div>
        );
    },
} );
