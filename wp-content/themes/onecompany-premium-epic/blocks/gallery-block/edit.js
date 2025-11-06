import { __ } from '@wordpress/i18n';
import {
    useBlockProps,
    InspectorControls,
    MediaUpload,
    MediaPlaceholder,
} from '@wordpress/block-editor';
import {
    PanelBody,
    Button,
    ButtonGroup,
    RangeControl,
    ToggleControl,
    TextControl,
} from '@wordpress/components';
import { Splide, SplideSlide } from '@splidejs/react-splide';
import '@splidejs/react-splide/css';

export default function Edit({ attributes, setAttributes }) {
    const {
        mediaItems,
        galleryType,
        columnsDesktop,
        columnsTablet,
        columnsMobile,
        gap,
        enableLightbox,
        sliderArrows,
        sliderPagination,
        sliderAutoplay,
        sliderAutoplayDelay,
    } = attributes;

    const blockProps = useBlockProps({
        className: `premium-gallery gallery-type--${galleryType}`,
    });

    const onSelectMedia = (items) => {
        const newItems = items.map((item) => ({
            id: item.id,
            url: item.url,
            alt: item.alt,
            type: item.type,
            caption: item.caption,
        }));
        setAttributes({ mediaItems: [...mediaItems, ...newItems] });
    };

    const removeMediaItem = (index) => {
        const newItems = [...mediaItems];
        newItems.splice(index, 1);
        setAttributes({ mediaItems: newItems });
    };

    const updateItemCaption = (caption, index) => {
        const newItems = [...mediaItems];
        newItems[index].caption = caption;
        setAttributes({ mediaItems: newItems });
    };

    const GalleryPreview = () => {
        if (galleryType === 'grid') {
            return (
                <div
                    className="premium-gallery__grid"
                    style={{ '--gap': `${gap}px`, '--cols-desktop': columnsDesktop, '--cols-tablet': columnsTablet, '--cols-mobile': columnsMobile }}
                >
                    {mediaItems.map((item, index) => (
                        <div key={item.id} className="premium-gallery__item">
                            {item.type === 'video' ? (
                                <video src={item.url} muted />
                            ) : (
                                <img src={item.url} alt={item.alt} />
                            )}
                             <Button
                                className="premium-gallery__remove-item"
                                icon="no-alt"
                                label={__('Видалити', 'onecompany-theme')}
                                onClick={() => removeMediaItem(index)}
                            />
                        </div>
                    ))}
                </div>
            );
        }

        if (galleryType === 'slider' || galleryType === 'carousel') {
             const splideOptions = {
                type: galleryType === 'slider' ? 'fade' : 'loop',
                perPage: galleryType === 'carousel' ? columnsDesktop : 1,
                perMove: 1,
                gap: `${gap}px`,
                arrows: sliderArrows,
                pagination: sliderPagination,
                autoplay: sliderAutoplay,
                interval: sliderAutoplayDelay,
                rewind: galleryType === 'slider',
                breakpoints: {
                    1024: {
                        perPage: galleryType === 'carousel' ? columnsTablet : 1,
                    },
                    640: {
                        perPage: galleryType === 'carousel' ? columnsMobile : 1,
                    },
                },
            };
            return (
                <Splide options={splideOptions} aria-label="Gallery Preview">
                    {mediaItems.map((item, index) => (
                        <SplideSlide key={item.id}>
                             <div className="premium-gallery__item">
                                {item.type === 'video' ? (
                                    <video src={item.url} controls={false} />
                                ) : (
                                    <img src={item.url} alt={item.alt} />
                                )}
                                <Button
                                    className="premium-gallery__remove-item"
                                    icon="no-alt"
                                    label={__('Видалити', 'onecompany-theme')}
                                    onClick={() => removeMediaItem(index)}
                                />
                            </div>
                        </SplideSlide>
                    ))}
                </Splide>
            );
        }
        return null;
    };

    return (
        <>
            <InspectorControls>
                <PanelBody title={__('Тип Галереї', 'onecompany-theme')}>
                    <ButtonGroup>
                        <Button isPrimary={galleryType === 'grid'} onClick={() => setAttributes({ galleryType: 'grid' })}>Сітка</Button>
                        <Button isPrimary={galleryType === 'slider'} onClick={() => setAttributes({ galleryType: 'slider' })}>Слайдер</Button>
                        <Button isPrimary={galleryType === 'carousel'} onClick={() => setAttributes({ galleryType: 'carousel' })}>Карусель</Button>
                    </ButtonGroup>
                </PanelBody>

                {galleryType === 'grid' && (
                    <PanelBody title={__('Налаштування Сітки', 'onecompany-theme')}>
                        <RangeControl label="Колонки (ПК)" value={columnsDesktop} onChange={(val) => setAttributes({ columnsDesktop: val })} min={1} max={8} />
                        <RangeControl label="Колонки (Планшет)" value={columnsTablet} onChange={(val) => setAttributes({ columnsTablet: val })} min={1} max={6} />
                        <RangeControl label="Колонки (Мобільний)" value={columnsMobile} onChange={(val) => setAttributes({ columnsMobile: val })} min={1} max={3} />
                    </PanelBody>
                )}

                {(galleryType === 'slider' || galleryType === 'carousel') && (
                     <PanelBody title={__('Налаштування Слайдера/Каруселі', 'onecompany-theme')}>
                        {galleryType === 'carousel' && (
                             <>
                                <RangeControl label="Колонки (ПК)" value={columnsDesktop} onChange={(val) => setAttributes({ columnsDesktop: val })} min={1} max={8} />
                                <RangeControl label="Колонки (Планшет)" value={columnsTablet} onChange={(val) => setAttributes({ columnsTablet: val })} min={1} max={6} />
                                <RangeControl label="Колонки (Мобільний)" value={columnsMobile} onChange={(val) => setAttributes({ columnsMobile: val })} min={1} max={3} />
                             </>
                        )}
                        <ToggleControl label="Стрілки" checked={sliderArrows} onChange={(val) => setAttributes({ sliderArrows: val })} />
                        <ToggleControl label="Пагінація" checked={sliderPagination} onChange={(val) => setAttributes({ sliderPagination: val })} />
                        <ToggleControl label="Автопрогравання" checked={sliderAutoplay} onChange={(val) => setAttributes({ sliderAutoplay: val })} />
                        {sliderAutoplay && (
                            <RangeControl label="Затримка (мс)" value={sliderAutoplayDelay} onChange={(val) => setAttributes({ sliderAutoplayDelay: val })} min={1000} max={10000} step={500} />
                        )}
                    </PanelBody>
                )}

                <PanelBody title={__('Загальні Налаштування', 'onecompany-theme')}>
                    <RangeControl label="Відступ (px)" value={gap} onChange={(val) => setAttributes({ gap: val })} min={0} max={64} />
                    <ToggleControl label="Лайтбокс" checked={enableLightbox} onChange={(val) => setAttributes({ enableLightbox: val })} />
                </PanelBody>
            </InspectorControls>

            <div {...blockProps}>
                {mediaItems.length === 0 ? (
                    <MediaPlaceholder
                        icon="format-gallery"
                        labels={{ title: 'Преміум Галерея', instructions: 'Завантажте або виберіть зображення та відео.' }}
                        onSelect={onSelectMedia}
                        allowedTypes={['image', 'video']}
                        multiple
                    />
                ) : (
                    <>
                        <GalleryPreview />
                        <div style={{textAlign: "center", marginTop: "1rem"}}>
                            <MediaUpload
                                onSelect={onSelectMedia}
                                allowedTypes={['image', 'video']}
                                multiple
                                gallery
                                value={mediaItems.map(item => item.id)}
                                render={({ open }) => <Button onClick={open} isSecondary>Додати/Редагувати</Button>}
                            />
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
