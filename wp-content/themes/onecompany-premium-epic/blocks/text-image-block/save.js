import { useBlockProps, RichText } from '@wordpress/block-editor';

export default function save({ attributes }) {
    const {
        mediaUrl,
        mediaAlt,
        title,
        content,
        buttonText,
        buttonLink,
        imagePosition,
        verticalAlignment,
    } = attributes;

    const blockProps = useBlockProps.save({
        className: `text-image-block align-${verticalAlignment} image-pos-${imagePosition}`,
    });

    return (
        <div {...blockProps}>
            <div className="text-image__media">
                {mediaUrl && <img src={mediaUrl} alt={mediaAlt} />}
            </div>
            <div className="text-image__text-content">
                <RichText.Content
                    tagName="h3"
                    className="text-image__title"
                    value={title}
                />
                <RichText.Content
                    tagName="div"
                    className="text-image__content"
                    value={content}
                />
                {buttonText && buttonLink && (
                    <div className="text-image__cta">
                        <a href={buttonLink} className="wp-block-button__link">
                            {buttonText}
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
