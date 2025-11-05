import { __ } from '@wordpress/i18n';
import { useBlockProps, InspectorControls, MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import { PanelBody, RangeControl, Button } from '@wordpress/components';

export default function Edit({ attributes, setAttributes }) {
    const { images, columns, gap } = attributes;

    const onSelectImages = (selectedImages) => {
        setAttributes({
            images: selectedImages.map((img) => ({
                id: img.id,
                url: img.url,
                alt: img.alt,
            })),
        });
    };

    const onRemoveImage = (index) => {
        const newImages = [...images];
        newImages.splice(index, 1);
        setAttributes({ images: newImages });
    };

    return (
        <>
            <InspectorControls>
                <PanelBody title={__('Налаштування галереї', 'onecompany-theme')}>
                    <RangeControl
                        label={__('Кількість колонок', 'onecompany-theme')}
                        value={columns}
                        onChange={(value) => setAttributes({ columns: value })}
                        min={1}
                        max={4}
                    />
                    <RangeControl
                        label={__('Відступи (px)', 'onecompany-theme')}
                        value={gap}
                        onChange={(value) => setAttributes({ gap: value })}
                        min={0}
                        max={50}
                    />
                </PanelBody>
            </InspectorControls>
            <div {...useBlockProps()}>
                <div
                    className="liquid-gallery"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${columns}, 1fr)`,
                        gap: `${gap}px`,
                    }}
                >
                    {images.map((image, index) => (
                        <div key={image.id} className="liquid-gallery__item">
                            <img src={image.url} alt={image.alt} />
                            <Button
                                onClick={() => onRemoveImage(index)}
                                isDestructive
                                style={{
                                    position: 'absolute',
                                    top: '10px',
                                    right: '10px',
                                }}
                            >
                                {__('Видалити', 'onecompany-theme')}
                            </Button>
                        </div>
                    ))}
                </div>
                <MediaUploadCheck>
                    <MediaUpload
                        onSelect={onSelectImages}
                        allowedTypes={['image']}
                        multiple
                        gallery
                        value={images.map((img) => img.id)}
                        render={({ open }) => (
                            <Button
                                onClick={open}
                                variant="primary"
                                style={{ marginTop: '20px' }}
                            >
                                {images.length === 0
                                    ? __('Додати зображення', 'onecompany-theme')
                                    : __('Додати ще зображення', 'onecompany-theme')}
                            </Button>
                        )}
                    />
                </MediaUploadCheck>
            </div>
        </>
    );
}
