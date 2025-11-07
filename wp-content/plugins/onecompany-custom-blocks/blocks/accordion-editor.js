const { registerBlockType } = wp.blocks;
const { InnerBlocks, InspectorControls } = wp.editor;
const { PanelBody, TextControl } = wp.components;
const { __ } = wp.i18n;

registerBlockType('onecompany/accordion', {
    title: __('Accordion', 'onecompany'),
    icon: 'menu',
    category: 'onecompany-blocks',
    attributes: {
        title: {
            type: 'string',
            default: 'Accordion Title',
        },
    },
    edit: ({ attributes, setAttributes }) => {
        const { title } = attributes;

        return (
            <div>
                <InspectorControls>
                    <PanelBody title={__('Accordion Settings', 'onecompany')}>
                        <TextControl
                            label={__('Title', 'onecompany')}
                            value={title}
                            onChange={(newTitle) => setAttributes({ title: newTitle })}
                        />
                    </PanelBody>
                </InspectorControls>
                <div className="accordion-editor">
                    <div className="accordion-editor-title">{title}</div>
                    <InnerBlocks />
                </div>
            </div>
        );
    },
    save: ({ attributes }) => {
        const { title } = attributes;

        return (
            <div className="accordion">
                <div className="accordion-item">
                    <div className="accordion-title">
                        {title}
                        <span className="accordion-icon">+</span>
                    </div>
                    <div className="accordion-content">
                        <InnerBlocks.Content />
                    </div>
                </div>
            </div>
        );
    },
});
