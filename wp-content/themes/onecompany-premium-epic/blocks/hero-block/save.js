import { useBlockProps, RichText } from '@wordpress/block-editor';

export default function save({ attributes }) {
    const { title, subtitle, videoUrl, accentColor } = attributes;

    return (
        <div {...useBlockProps.save({
            className: 'epic-intro epic-slide',
            style: { '--accent': accentColor }
        })}>
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
                <span className="epic-intro__label">THE ART OF AUTOMOTIVE</span>
                <h1 className="epic-intro__title">
                    <RichText.Content tagName="span" className="epic-intro__title-word" value={title} />
                </h1>
                <p className="epic-intro__subtitle">
                    <RichText.Content tagName="span" value={subtitle} />
                </p>
            </div>
        </div>
    );
}
