import Splide from '@splidejs/splide';
import '@splidejs/splide/css';
import fslightbox from 'fslightbox';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

class PremiumGallery {
    constructor(galleryElement) {
        this.gallery = galleryElement;
        this.galleryType = this.gallery.dataset.galleryType || 'grid';

        this.init();
    }

    init() {
        if (this.gallery.dataset.galleryLightbox === 'true') {
            this.initLightbox();
        }

        if (this.galleryType === 'slider' || this.galleryType === 'carousel') {
            this.initSlider();
        }

        this.animateIn();
    }

    initLightbox() {
        // The fslightbox script finds the [data-fslightbox] attributes automatically.
        // We just need to refresh it if content is loaded dynamically.
        // In our case, it's not, but it's good practice.
        if (window.fsLightbox) {
            window.fsLightbox.global.refresh();
        }
    }

    initSlider() {
        const splideEl = this.gallery.querySelector('.splide');
        if (!splideEl) return;

        const options = {
            type: this.galleryType === 'slider' ? 'fade' : 'loop',
            perPage: parseInt(this.gallery.dataset.colsDesktop, 10) || 1,
            perMove: 1,
            gap: `${this.gallery.dataset.galleryGap || 16}px`,
            arrows: this.gallery.dataset.sliderArrows === 'true',
            pagination: this.gallery.dataset.sliderPagination === 'true',
            autoplay: this.gallery.dataset.sliderAutoplay === 'true',
            interval: parseInt(this.gallery.dataset.sliderDelay, 10) || 3000,
            rewind: this.galleryType === 'slider',
            rewindSpeed: 800,
            speed: 800,
            easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
            breakpoints: {
                1024: {
                    perPage: this.galleryType === 'carousel' ? (parseInt(this.gallery.dataset.colsTablet, 10) || 2) : 1,
                },
                640: {
                     perPage: this.galleryType === 'carousel' ? (parseInt(this.gallery.dataset.colsMobile, 10) || 1) : 1,
                },
            },
        };

        new Splide(splideEl, options).mount();
    }

    animateIn() {
        const items = this.gallery.querySelectorAll('.premium-gallery__item, .splide__slide');

        gsap.from(items, {
            autoAlpha: 0,
            y: 50,
            scale: 0.95,
            duration: 0.8,
            stagger: 0.1,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: this.gallery,
                start: 'top 85%',
                toggleActions: 'play none none reverse',
            },
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const galleries = document.querySelectorAll('.premium-gallery');
    galleries.forEach(gallery => new PremiumGallery(gallery));
});
