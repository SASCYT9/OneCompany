import { useBlockProps, RichText } from '@wordpress/block-editor';

export default function save({ attributes }) {
    const {
        eyebrow,
        title,
        subtitle,
        mediaUrl,
        primaryBtnText,
        primaryBtnLink,
        secondaryBtnText,
        secondaryBtnLink
    } = attributes;

    const blockProps = useBlockProps.save({ className: 'hero' });

    return (
        <section {...blockProps}>
            <div className="hero__media">
                {mediaUrl && (
                    <video className="hero__video" src={mediaUrl} autoPlay muted loop playsInline />
                )}
                <div className="hero__scrim"></div>
            </div>
            <div className="hero__inner">
                <RichText.Content
                    tagName="p"
                    className="hero__eyebrow"
                    value={eyebrow}
                />
                <RichText.Content
                    tagName="h1"
                    className="hero__title"
                    value={title}
                />
                <RichText.Content
                    tagName="p"
                    className="hero__subtitle"
                    value={subtitle}
                />
                <div className="hero__cta">
                    <a href={primaryBtnLink} className="hero__button">
                        {primaryBtnText}
                    </a>
                    <a href={secondaryBtnLink} className="hero__button hero__button--ghost">
                        {secondaryBtnText}
                    </a>
                </div>
            </div>
        </section>
    );
}
