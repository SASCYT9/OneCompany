import { __ } from '@wordpress/i18n';
import { useBlockProps, InspectorControls, RichText, MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import { PanelBody, TextControl, Button } from '@wordpress/components';

export default function Edit({ attributes, setAttributes }) {
    const {
        eyebrow,
        title,
        subtitle,
        mediaId,
        mediaUrl,
        primaryBtnText,
        primaryBtnLink,
        secondaryBtnText,
        secondaryBtnLink
    } = attributes;

    const blockProps = useBlockProps({ className: 'hero' });

    const onSelectMedia = (media) => {
        setAttributes({
            mediaId: media.id,
            mediaUrl: media.url
        });
    };

    return (
        <>
            <InspectorControls>
                <PanelBody title={__('Налаштування відео', 'onecompany-theme')}>
                    <div className="editor-styles-wrapper">
                        <MediaUploadCheck>
                            <MediaUpload
                                onSelect={onSelectMedia}
                                allowedTypes={['video']}
                                value={mediaId}
                                render={({ open }) => (
                                    <Button onClick={open} isPrimary>
                                        {!mediaId ? __('Завантажити/вибрати відео', 'onecompany-theme') : __('Замінити відео', 'onecompany-theme')}
                                    </Button>
                                )}
                            />
                        </MediaUploadCheck>
                        {mediaUrl && (
                             <p style={{ marginTop: '10px' }}>{__('Поточне відео:', 'onecompany-theme')} {mediaUrl.split('/').pop()}</p>
                        )}
                    </div>
                </PanelBody>
                <PanelBody title={__('Налаштування кнопок', 'onecompany-theme')}>
                    <TextControl
                        label={__('Текст основної кнопки', 'onecompany-theme')}
                        value={primaryBtnText}
                        onChange={(value) => setAttributes({ primaryBtnText: value })}
                    />
                     <TextControl
                        label={__('Посилання основної кнопки', 'onecompany-theme')}
                        value={primaryBtnLink}
                        onChange={(value) => setAttributes({ primaryBtnLink: value })}
                    />
                    <hr />
                    <TextControl
                        label={__('Текст другорядної кнопки', 'onecompany-theme')}
                        value={secondaryBtnText}
                        onChange={(value) => setAttributes({ secondaryBtnText: value })}
                    />
                     <TextControl
                        label={__('Посилання другорядної кнопки', 'onecompany-theme')}
                        value={secondaryBtnLink}
                        onChange={(value) => setAttributes({ secondaryBtnLink: value })}
                    />
                </PanelBody>
            </InspectorControls>

            <section {...blockProps}>
                <div className="hero__media">
                    {mediaUrl && (
                        <video src={mediaUrl} autoPlay muted loop playsInline />
                    )}
                    <div className="hero__scrim"></div>
                </div>
                <div className="hero__inner">
                    <RichText
                        tagName="p"
                        className="hero__eyebrow"
                        value={eyebrow}
                        onChange={(value) => setAttributes({ eyebrow: value })}
                        placeholder={__('The Art of Automotive', 'onecompany-theme')}
                    />
                    <RichText
                        tagName="h1"
                        className="hero__title"
                        value={title}
                        onChange={(value) => setAttributes({ title: value })}
                        placeholder={__('ONECOMPANY', 'onecompany-theme')}
                    />
                    <RichText
                        tagName="p"
                        className="hero__subtitle"
                        value={subtitle}
                        onChange={(value) => setAttributes({ subtitle: value })}
                        placeholder={__('Преміум автомобільні аксесуари та тюнінг', 'onecompany-theme')}
                    />
                    <div className="hero__cta">
                        <a href={primaryBtnLink} className="hero__button">{primaryBtnText}</a>
                        <a href={secondaryBtnLink} className="hero__button hero__button--ghost">{secondaryBtnText}</a>
                    </div>
                </div>
            </section>
        </>
    );
}
