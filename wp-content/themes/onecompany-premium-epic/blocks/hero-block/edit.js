import { __ } from '@wordpress/i18n';
import { useBlockProps, InspectorControls, RichText, MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import { PanelBody, TextControl, Button } from '@wordpress/components';

export default function Edit({ attributes, setAttributes }) {
    const { title, subtitle, videoUrl, accentColor } = attributes;
    const blockProps = useBlockProps({
        className: 'epic-intro epic-slide',
        style: {
            '--accent': accentColor
        }
    });

    return (
        <>
            <InspectorControls>
                <PanelBody title={__('Налаштування Hero', 'onecompany-theme')}>
                    <TextControl
                        label={__('URL відео', 'onecompany-theme')}
                        value={videoUrl}
                        onChange={(value) => setAttributes({ videoUrl: value })}
                        placeholder="/wp-content/uploads/hero.mp4"
                    />
                    <TextControl
                        label={__('Колір акценту', 'onecompany-theme')}
                        value={accentColor}
                        onChange={(value) => setAttributes({ accentColor: value })}
                        type="color"
                    />
                </PanelBody>
            </InspectorControls>
            <div {...blockProps}>
                <div className="epic-intro__bg-wrapper">
                    {videoUrl && (
                        <video
                            className="epic-intro__video"
                            src={videoUrl}
                            autoPlay
                            muted
                            loop
                            playsInline
                        />
                    )}
                    <div className="epic-intro__overlay"></div>
                </div>
                <div className="epic-intro__content">
                    <span className="epic-intro__label">{__('THE ART OF AUTOMOTIVE', 'onecompany-theme')}</span>
                    <h1 className="epic-intro__title">
                        <RichText
                            tagName="span"
                            className="epic-intro__title-word"
                            value={title}
                            onChange={(value) => setAttributes({ title: value })}
                            placeholder={__('ONECOMPANY', 'onecompany-theme')}
                        />
                    </h1>
                    <p className="epic-intro__subtitle">
                        <RichText
                            tagName="span"
                            value={subtitle}
                            onChange={(value) => setAttributes({ subtitle: value })}
                            placeholder={__('Преміум автомобільні аксесуари', 'onecompany-theme')}
                        />
                    </p>
                </div>
            </div>
        </>
    );
}
