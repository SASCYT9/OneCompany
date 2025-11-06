import { __ } from '@wordpress/i18n';
import {
    useBlockProps,
    RichText,
    BlockControls,
} from '@wordpress/block-editor';
import { AlignmentToolbar } from '@wordpress/block-editor';

export default function Edit({ attributes, setAttributes }) {
    const { eyebrow, title, subtitle, alignment } = attributes;

    const blockProps = useBlockProps({
        className: 'section-heading',
        style: { textAlign: alignment },
    });

    return (
        <>
            <BlockControls>
                <AlignmentToolbar
                    value={alignment}
                    onChange={(newAlignment) => setAttributes({ alignment: newAlignment })}
                />
            </BlockControls>
            <div {...blockProps}>
                <RichText
                    tagName="p"
                    className="section-heading__eyebrow"
                    value={eyebrow}
                    onChange={(value) => setAttributes({ eyebrow: value })}
                    placeholder={__('Eyebrow текст...', 'onecompany-theme')}
                />
                <RichText
                    tagName="h2"
                    className="section-heading__title"
                    value={title}
                    onChange={(value) => setAttributes({ title: value })}
                    placeholder={__('Заголовок секції...', 'onecompany-theme')}
                />
                <RichText
                    tagName="p"
                    className="section-heading__subtitle"
                    value={subtitle}
                    onChange={(value) => setAttributes({ subtitle: value })}
                    placeholder={__('Підзаголовок секції...', 'onecompany-theme')}
                />
            </div>
        </>
    );
}
