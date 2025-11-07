const { registerBlockType } = wp.blocks;
const { InnerBlocks, InspectorControls } = wp.editor;
const { PanelBody, TextControl } = wp.components;
const { __ } = wp.i18n;

registerBlockType('onecompany/tabs', {
    title: __('Tabs', 'onecompany'),
    icon: 'index-card',
    category: 'onecompany-blocks',
    attributes: {
        tabTitles: {
            type: 'array',
            default: ['Tab 1', 'Tab 2', 'Tab 3'],
        },
    },
    edit: ({ attributes, setAttributes }) => {
        const { tabTitles } = attributes;

        const updateTabTitle = (newTitle, index) => {
            const newTabTitles = [...tabTitles];
            newTabTitles[index] = newTitle;
            setAttributes({ tabTitles: newTabTitles });
        };

        return (
            <div>
                <InspectorControls>
                    <PanelBody title={__('Tab Settings', 'onecompany')}>
                        {tabTitles.map((title, index) => (
                            <TextControl
                                key={index}
                                label={`${__('Tab', 'onecompany')} ${index + 1} ${__('Title', 'onecompany')}`}
                                value={title}
                                onChange={(newTitle) => updateTabTitle(newTitle, index)}
                            />
                        ))}
                    </PanelBody>
                </InspectorControls>
                <div className="tabs-editor">
                    <div className="tabs-titles">
                        {tabTitles.map((title, index) => (
                            <div key={index} className="tab-title-editor">{title}</div>
                        ))}
                    </div>
                    <InnerBlocks
                        allowedBlocks={['core/paragraph', 'core/heading', 'core/list']}
                        template={tabTitles.map(() => ['core/paragraph', {}])}
                        templateLock="all"
                    />
                </div>
            </div>
        );
    },
    save: ({ attributes }) => {
        const { tabTitles } = attributes;

        return (
            <div className="tabs-container">
                <div className="tab-titles">
                    {tabTitles.map((title, index) => (
                        <button key={index} className={`tab-title ${index === 0 ? 'active' : ''}`} data-tab={index}>
                            {title}
                        </button>
                    ))}
                </div>
                <div className="tab-contents">
                    <InnerBlocks.Content />
                </div>
            </div>
        );
    },
});
