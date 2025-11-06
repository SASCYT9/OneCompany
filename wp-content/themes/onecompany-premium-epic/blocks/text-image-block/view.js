import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

document.addEventListener('DOMContentLoaded', () => {
    const textImageBlocks = document.querySelectorAll('.text-image-block');

    textImageBlocks.forEach(block => {
        const media = block.querySelector('.text-image__media');
        const text = block.querySelector('.text-image__text-content');

        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: block,
                start: 'top 85%',
                toggleActions: 'play none none reverse',
            },
        });

        const isImageRight = block.classList.contains('image-pos-right');

        tl.from(media, { autoAlpha: 0, x: isImageRight ? 50 : -50, duration: 1, ease: 'power3.out' })
          .from(text.children, { autoAlpha: 0, y: 30, stagger: 0.2, duration: 0.8, ease: 'power3.out' }, '-=0.7');
    });
});
