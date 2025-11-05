import { __ } from '@wordpress/i18n';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, RangeControl, SelectControl, ToggleControl } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import ServerSideRender from '@wordpress/server-side-render';

export default function Edit({ attributes, setAttributes }) {
    const { numberOfPosts, selectedCategory, columns, showDescription } = attributes;

    const categories = useSelect((select) => {
        return select('core').getEntityRecords('taxonomy', 'brand_category');
    }, []);

    // Отримуємо бренди для живого preview
    const brands = useSelect((select) => {
        return select('core').getEntityRecords('postType', 'brand', {
            per_page: numberOfPosts || 6,
            _embed: true
        });
    }, [numberOfPosts]);

    let categoryOptions = [{ value: '', label: __('Всі категорії', 'onecompany-theme') }];
    if (categories) {
        categories.forEach((category) => {
            categoryOptions.push({ value: category.id, label: category.name });
        });
    }

    const blockProps = useBlockProps({
        className: 'onecompany-brand-grid-editor',
    });

    return (
        <>
            <InspectorControls>
                <PanelBody title={__('Налаштування сітки брендів', 'onecompany-theme')}>
                    <RangeControl
                        label={__('Кількість брендів', 'onecompany-theme')}
                        value={numberOfPosts || 6}
                        onChange={(value) => setAttributes({ numberOfPosts: value })}
                        min={1}
                        max={50}
                    />
                    <RangeControl
                        label={__('Колонок у сітці', 'onecompany-theme')}
                        value={columns || 3}
                        onChange={(value) => setAttributes({ columns: value })}
                        min={2}
                        max={6}
                    />
                    <SelectControl
                        label={__('Категорія бренду', 'onecompany-theme')}
                        value={selectedCategory}
                        options={categoryOptions}
                        onChange={(value) => setAttributes({ selectedCategory: value })}
                    />
                    <ToggleControl
                        label={__('Показувати опис', 'onecompany-theme')}
                        checked={showDescription}
                        onChange={(value) => setAttributes({ showDescription: value })}
                    />
                </PanelBody>
            </InspectorControls>
            <div {...blockProps}>
                <div className="onecompany-editor-preview">
                    <p style={{ 
                        textAlign: 'center', 
                        color: '#c9a961', 
                        fontSize: '14px',
                        marginBottom: '20px',
                        fontWeight: '600'
                    }}>
                        📊 Preview: {numberOfPosts || 6} брендів | {columns || 3} колонки
                    </p>
                    <ServerSideRender
                        block="onecompany/brand-grid-block"
                        attributes={attributes}
                        EmptyResponsePlaceholder={() => (
                            <div style={{
                                padding: '40px',
                                textAlign: 'center',
                                border: '2px dashed #c9a961',
                                borderRadius: '8px',
                                background: '#0a0a0a'
                            }}>
                                <p style={{ color: '#c9a961', fontSize: '16px' }}>
                                    🏁 Бренди завантажуються...
                                </p>
                                <p style={{ color: '#666', fontSize: '14px' }}>
                                    Якщо бренди не з'являються, імпортуйте їх через Tools → Import Brands
                                </p>
                            </div>
                        )}
                    />
                </div>
            </div>
        </>
    );
}
