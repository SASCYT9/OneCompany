import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

document.addEventListener('DOMContentLoaded', () => {
    const heroBlock = document.querySelector('.hero');
    if (!heroBlock) return;

    const eyebrow = heroBlock.querySelector('.hero__eyebrow');
    const title = heroBlock.querySelector('.hero__title');
    const subtitle = heroBlock.querySelector('.hero__subtitle');
    const cta = heroBlock.querySelector('.hero__cta');

    gsap.set([eyebrow, title, subtitle, cta], { autoAlpha: 0, y: 30 });

    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: heroBlock,
            start: 'top 80%',
            toggleActions: 'play none none reverse'
        }
    });

    tl.to(eyebrow, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out' })
      .to(title, { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out' }, '-=0.6')
      .to(subtitle, { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out' }, '-=0.7')
      .to(cta, { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out' }, '-=0.7');
});
