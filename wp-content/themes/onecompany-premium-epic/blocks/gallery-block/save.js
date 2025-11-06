import { useBlockProps } from '@wordpress/block-editor';

export default function save({ attributes }) {
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

    const blockProps = useBlockProps.save({
        'data-gallery-type': galleryType,
        'data-gallery-gap': gap,
        'data-gallery-lightbox': enableLightbox ? 'true' : 'false',
        'data-slider-arrows': sliderArrows ? 'true' : 'false',
        'data-slider-pagination': sliderPagination ? 'true' : 'false',
        'data-slider-autoplay': sliderAutoplay ? 'true' : 'false',
        'data-slider-delay': sliderAutoplayDelay,
        'data-cols-desktop': columnsDesktop,
        'data-cols-tablet': columnsTablet,
        'data-cols-mobile': columnsMobile,
        className: `premium-gallery gallery-type--${galleryType}`,
    });

    const GalleryItem = ({ item }) => (
        <a
            href={item.url}
            className="premium-gallery__item-link"
            data-fslightbox="gallery"
            data-type={item.type === 'video' ? 'video' : 'image'}
            aria-label={item.caption || 'View media'}
        >
            <div className="premium-gallery__item">
                {item.type === 'video' ? (
                     <video className="premium-gallery__media" src={item.url} playsInline muted loop />
                ) : (
                    <img className="premium-gallery__media" src={item.url} alt={item.alt} />
                )}
                <div className="premium-gallery__overlay">
                     <span className="premium-gallery__icon"></span>
                </div>
            </div>
        </a>
    );

    if (!mediaItems || mediaItems.length === 0) {
        return null;
    }

    return (
        <div {...blockProps}>
            {galleryType === 'grid' ? (
                <div
                    className="premium-gallery__grid"
                    style={{ '--gap': `${gap}px`, '--cols-desktop': columnsDesktop, '--cols-tablet': columnsTablet, '--cols-mobile': columnsMobile }}
                >
                    {mediaItems.map((item) => <GalleryItem key={item.id} item={item} />)}
                </div>
            ) : (
                <div className="splide">
                    <div className="splide__track">
                        <ul className="splide__list">
                            {mediaItems.map((item) => (
                                <li key={item.id} className="splide__slide">
                                    <GalleryItem item={item} />
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
