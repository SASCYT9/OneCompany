import { __ } from '@wordpress/i18n';
import {
    useBlockProps,
    InspectorControls,
    RichText,
    MediaUpload,
    MediaPlaceholder,
    BlockControls,
} from '@wordpress/block-editor';
import {
    PanelBody,
    Button,
    TextControl,
    ToolbarGroup,
    ToolbarButton,
    DropdownMenu,
} from '@wordpress/components';
import { pullLeft, pullRight, stretchFullWidth } from '@wordpress/icons';

export default function Edit({ attributes, setAttributes }) {
    const {
        mediaId,
        mediaUrl,
        mediaAlt,
        title,
        content,
        buttonText,
        buttonLink,
        imagePosition,
        verticalAlignment,
    } = attributes;

    const blockProps = useBlockProps({
        className: `text-image-block align-${verticalAlignment} image-pos-${imagePosition}`,
    });

    const onSelectMedia = (media) => {
        setAttributes({
            mediaId: media.id,
            mediaUrl: media.url,
            mediaAlt: media.alt,
        });
    };

    return (
        <>
            <InspectorControls>
                <PanelBody title={__('Налаштування кнопки', 'onecompany-theme')}>
                    <TextControl
                        label={__('Текст кнопки', 'onecompany-theme')}
                        value={buttonText}
                        onChange={(val) => setAttributes({ buttonText: val })}
                    />
                    <TextControl
                        label={__('Посилання кнопки', 'onecompany-theme')}
                        value={buttonLink}
                        onChange={(val) => setAttributes({ buttonLink: val })}
                    />
                </PanelBody>
            </InspectorControls>

            <BlockControls>
                <ToolbarGroup>
                    <ToolbarButton
                        icon={pullLeft}
                        label={__('Зображення ліворуч', 'onecompany-theme')}
                        isActive={imagePosition === 'left'}
                        onClick={() => setAttributes({ imagePosition: 'left' })}
                    />
                    <ToolbarButton
                        icon={pullRight}
                        label={__('Зображення праворуч', 'onecompany-theme')}
                        isActive={imagePosition === 'right'}
                        onClick={() => setAttributes({ imagePosition: 'right' })}
                    />
                </ToolbarGroup>
                 <ToolbarGroup>
                    <DropdownMenu
                        icon={stretchFullWidth}
                        label={__('Вертикальне вирівнювання', 'onecompany-theme')}
                        controls={[
                            { title: 'По верху', onClick: () => setAttributes({ verticalAlignment: 'top' }) },
                            { title: 'По центру', onClick: () => setAttributes({ verticalAlignment: 'center' }) },
                            { title: 'По низу', onClick: () => setAttributes({ verticalAlignment: 'bottom' }) },
                        ]}
                    />
                </ToolbarGroup>
            </BlockControls>

            <div {...blockProps}>
                <div className="text-image__media">
                    {mediaUrl ? (
                        <>
                            <img src={mediaUrl} alt={mediaAlt} />
                             <Button
                                className="text-image__remove-media"
                                isDestructive
                                icon="no-alt"
                                onClick={() => setAttributes({ mediaId: 0, mediaUrl: '', mediaAlt: '' })}
                            />
                        </>
                    ) : (
                        <MediaPlaceholder
                            icon="format-image"
                            labels={{ title: 'Вибрати зображення' }}
                            onSelect={onSelectMedia}
                            allowedTypes={['image']}
                        />
                    )}
                </div>
                <div className="text-image__text-content">
                    <RichText
                        tagName="h3"
                        className="text-image__title"
                        value={title}
                        onChange={(val) => setAttributes({ title: val })}
                        placeholder={__('Заголовок...', 'onecompany-theme')}
                    />
                    <RichText
                        tagName="div"
                        className="text-image__content"
                        multiline="p"
                        value={content}
                        onChange={(val) => setAttributes({ content: val })}
                         placeholder={__('Текст...', 'onecompany-theme')}
                    />
                    {buttonText && (
                        <div className="text-image__cta">
                            <a href="#" className="wp-block-button__link">
                                {buttonText}
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
