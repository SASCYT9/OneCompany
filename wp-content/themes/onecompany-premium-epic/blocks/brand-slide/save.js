import { useBlockProps, RichText } from '@wordpress/block-editor';

export default function save({ attributes }) {
    const { brandName, brandDescription, videoUrl, slideNumber, accentColor } = attributes;

    return (
        <div {...useBlockProps.save({
            className: 'epic-slide',
            style: { '--accent': accentColor }
        })}>
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
                    <RichText.Content tagName="span" value={brandName} />
                </h2>
                <div className="epic-slide__divider"></div>
                <p className="epic-slide__description">
                    <RichText.Content tagName="span" value={brandDescription} />
                </p>
            </div>
        </div>
    );
}
