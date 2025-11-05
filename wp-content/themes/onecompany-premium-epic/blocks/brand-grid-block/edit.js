import { __ } from '@wordpress/i18n';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, RangeControl, SelectControl } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import ServerSideRender from '@wordpress/server-side-render';

export default function Edit({ attributes, setAttributes }) {
    const { numberOfPosts, selectedCategory } = attributes;

    const categories = useSelect((select) => {
        return select('core').getEntityRecords('taxonomy', 'brand_category');
    }, []);

    let categoryOptions = [{ value: '', label: __('Всі категорії', 'onecompany-theme') }];
    if (categories) {
        categories.forEach((category) => {
            categoryOptions.push({ value: category.id, label: category.name });
        });
    }

    return (
        <>
            <InspectorControls>
                <PanelBody title={__('Налаштування сітки брендів', 'onecompany-theme')}>
                    <RangeControl
                        label={__('Кількість брендів', 'onecompany-theme')}
                        value={numberOfPosts}
                        onChange={(value) => setAttributes({ numberOfPosts: value })}
                        min={1}
                        max={12}
                    />
                    <SelectControl
                        label={__('Категорія бренду', 'onecompany-theme')}
                        value={selectedCategory}
                        options={categoryOptions}
                        onChange={(value) => setAttributes({ selectedCategory: value })}
                    />
                </PanelBody>
            </InspectorControls>
            <div {...useBlockProps()}>
                <ServerSideRender
                    block="onecompany/brand-grid-block"
                    attributes={attributes}
                />
            </div>
        </>
    );
}
