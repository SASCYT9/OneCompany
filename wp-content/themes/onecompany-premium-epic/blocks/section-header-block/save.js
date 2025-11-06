import { useBlockProps, RichText } from '@wordpress/block-editor';

export default function save({ attributes }) {
    const { eyebrow, title, subtitle, alignment } = attributes;

    const blockProps = useBlockProps.save({
        className: 'section-heading',
        style: { textAlign: alignment },
    });

    return (
        <div {...blockProps}>
            <RichText.Content
                tagName="p"
                className="section-heading__eyebrow"
                value={eyebrow}
            />
            <RichText.Content
                tagName="h2"
                className="section-heading__title"
                value={title}
            />
            <RichText.Content
                tagName="p"
                className="section-heading__subtitle"
                value={subtitle}
            />
        </div>
    );
}
