import { __ } from '@wordpress/i18n';
import { useBlockProps, InspectorControls, RichText, MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import { PanelBody, TextControl, Button } from '@wordpress/components';

export default function Edit({ attributes, setAttributes }) {
    const { title, subtitle, videoUrl, accentColor } = attributes;
    const blockProps = useBlockProps({
        className: 'epic-intro epic-slide',
        style: {
            '--accent': accentColor,
            minHeight: '400px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a0a0a',
            borderRadius: '8px',
            overflow: 'hidden'
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
                        help={__('Для кращого preview завантажте відео через Media Library', 'onecompany-theme')}
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
                <div className="epic-intro__bg-wrapper" style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 1
                }}>
                    {videoUrl ? (
                        <video
                            className="epic-intro__video"
                            src={videoUrl}
                            autoPlay
                            muted
                            loop
                            playsInline
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                            }}
                        />
                    ) : (
                        <div style={{
                            width: '100%',
                            height: '100%',
                            background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <p style={{ color: '#666', fontSize: '14px' }}>
                                🎬 Додайте URL відео у налаштуваннях справа →
                            </p>
                        </div>
                    )}
                    <div className="epic-intro__overlay" style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        background: 'rgba(0,0,0,0.5)'
                    }}></div>
                </div>
                <div className="epic-intro__content" style={{
                    position: 'relative',
                    zIndex: 2,
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: '#fff'
                }}>
                    <span className="epic-intro__label" style={{
                        display: 'block',
                        fontSize: '14px',
                        letterSpacing: '2px',
                        color: accentColor || '#c9a961',
                        marginBottom: '20px',
                        fontWeight: '600'
                    }}>
                        {__('THE ART OF AUTOMOTIVE', 'onecompany-theme')}
                    </span>
                    <h1 className="epic-intro__title" style={{
                        fontSize: '72px',
                        fontWeight: '900',
                        margin: '0 0 20px 0',
                        lineHeight: '1'
                    }}>
                        <RichText
                            tagName="span"
                            className="epic-intro__title-word"
                            value={title}
                            onChange={(value) => setAttributes({ title: value })}
                            placeholder={__('ONECOMPANY', 'onecompany-theme')}
                            style={{ color: '#fff' }}
                        />
                    </h1>
                    <p className="epic-intro__subtitle" style={{
                        fontSize: '18px',
                        color: '#ccc',
                        margin: 0
                    }}>
                        <RichText
                            tagName="span"
                            value={subtitle}
                            onChange={(value) => setAttributes({ subtitle: value })}
                            placeholder={__('premium tuning parts. 100+ brands. one company.', 'onecompany-theme')}
                        />
                    </p>
                </div>
            </div>
        </>
    );
}
