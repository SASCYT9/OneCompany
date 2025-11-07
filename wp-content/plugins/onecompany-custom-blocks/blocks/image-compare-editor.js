const { registerBlockType } = wp.blocks;
const { MediaUpload, MediaUploadCheck } = wp.editor;
const { Button, PanelBody } = wp.components;
const { __ } = wp.i18n;

registerBlockType('onecompany/image-compare', {
    title: __('Image Compare', 'onecompany'),
    icon: 'image-flip-horizontal',
    category: 'onecompany-blocks',
    attributes: {
        beforeImage: {
            type: 'object',
        },
        afterImage: {
            type: 'object',
        },
    },
    edit: ({ attributes, setAttributes }) => {
        const { beforeImage, afterImage } = attributes;

        return (
            <div>
                <PanelBody title={__('Images', 'onecompany')}>
                    <MediaUploadCheck>
                        <MediaUpload
                            onSelect={(media) => setAttributes({ beforeImage: media })}
                            allowedTypes={['image']}
                            value={beforeImage}
                            render={({ open }) => (
                                <Button onClick={open} isPrimary>
                                    {beforeImage ? __('Change Before Image', 'onecompany') : __('Choose Before Image', 'onecompany')}
                                </Button>
                            )}
                        />
                    </MediaUploadCheck>
                    <MediaUploadCheck>
                        <MediaUpload
                            onSelect={(media) => setAttributes({ afterImage: media })}
                            allowedTypes={['image']}
                            value={afterImage}
                            render={({ open }) => (
                                <Button onClick={open} isPrimary>
                                    {afterImage ? __('Change After Image', 'onecompany') : __('Choose After Image', 'onecompany')}
                                </Button>
                            )}
                        />
                    </MediaUploadCheck>
                </PanelBody>
                <div className="image-compare-editor">
                    {beforeImage && <img src={beforeImage.url} alt={beforeImage.alt} />}
                    {afterImage && <img src={afterImage.url} alt={afterImage.alt} />}
                </div>
            </div>
        );
    },
    save: ({ attributes }) => {
        const { beforeImage, afterImage } = attributes;

        if (!beforeImage || !afterImage) {
            return null;
        }

        return (
            <div className="beer-slider" data-beer-label="Before">
                <img src={beforeImage.url} alt={beforeImage.alt} />
                <div className="beer-reveal" data-beer-label="After">
                    <img src={afterImage.url} alt={afterImage.alt} />
                </div>
            </div>
        );
    },
});
