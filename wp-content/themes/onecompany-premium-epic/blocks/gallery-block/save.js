import { useBlockProps } from '@wordpress/block-editor';

export default function save({ attributes }) {
    const { images, columns, gap } = attributes;

    return (
        <div {...useBlockProps.save()}>
            <div
                className="liquid-gallery"
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${columns}, 1fr)`,
                    gap: `${gap}px`,
                }}
            >
                {images.map((image) => (
                    <div key={image.id} className="liquid-gallery__item">
                        <a href={image.url} data-lightbox="gallery">
                            <img src={image.url} alt={image.alt} />
                        </a>
                    </div>
                ))}
            </div>
        </div>
    );
}
