import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

document.addEventListener('DOMContentLoaded', () => {
    const brandCards = document.querySelectorAll('.brand-card');

    // 1. Staggered reveal animation on scroll
    gsap.from(brandCards, {
        autoAlpha: 0,
        y: 50,
        duration: 0.8,
        stagger: 0.15,
        ease: 'power3.out',
        scrollTrigger: {
            trigger: '.brands-grid',
            start: 'top 85%',
            toggleActions: 'play none none reverse',
        },
    });

    // 2. Interactive glow effect on hover
    const isTouchDevice = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (!isTouchDevice()) {
        brandCards.forEach(card => {
            card.addEventListener('pointermove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                gsap.to(card, {
                    '--pointer-x': `${x}px`,
                    '--pointer-y': `${y}px`,
                    duration: 0.6,
                    ease: 'power2.out'
                });
            });

            card.addEventListener('pointerleave', () => {
                gsap.to(card, {
                    '--pointer-x': '50%',
                    '--pointer-y': '50%',
                    duration: 0.8,
                    ease: 'elastic.out(1, 0.5)'
                });
            });
        });
    } else {
        brandCards.forEach(card => {
            card.classList.add('brand-card--touch');
        });
    }
});
