import { __ } from '@wordpress/i18n';
import { useBlockProps, InspectorControls, RichText } from '@wordpress/block-editor';
import { PanelBody, TextControl } from '@wordpress/components';

export default function Edit({ attributes, setAttributes }) {
    const { brandName, brandDescription, videoUrl, slideNumber, accentColor } = attributes;
    const blockProps = useBlockProps({
        className: 'epic-slide',
        style: {
            '--accent': accentColor
        }
    });

    return (
        <>
            <InspectorControls>
                <PanelBody title={__('Налаштування слайду', 'onecompany-theme')}>
                    <TextControl
                        label={__('Номер слайду', 'onecompany-theme')}
                        value={slideNumber}
                        onChange={(value) => setAttributes({ slideNumber: value })}
                    />
                    <TextControl
                        label={__('URL відео', 'onecompany-theme')}
                        value={videoUrl}
                        onChange={(value) => setAttributes({ videoUrl: value })}
                        placeholder="/wp-content/uploads/brand.mp4"
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
                <div className="epic-slide__bg-wrapper">
                    {videoUrl && (
                        <video
                            className="epic-slide__video"
                            src={videoUrl}
                            autoPlay
                            muted
                            loop
                            playsInline
                        />
                    )}
                    <div className="epic-slide__overlay"></div>
                </div>
                <div className="epic-slide__content">
                    <span className="epic-slide__number">{slideNumber}</span>
                    <h2 className="epic-slide__title">
                        <RichText
                            tagName="span"
                            value={brandName}
                            onChange={(value) => setAttributes({ brandName: value })}
                            placeholder={__('Назва бренду', 'onecompany-theme')}
                        />
                    </h2>
                    <div className="epic-slide__divider"></div>
                    <p className="epic-slide__description">
                        <RichText
                            tagName="span"
                            value={brandDescription}
                            onChange={(value) => setAttributes({ brandDescription: value })}
                            placeholder={__('Опис бренду', 'onecompany-theme')}
                        />
                    </p>
                </div>
            </div>
        </>
    );
}
