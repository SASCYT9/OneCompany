/**
 * OneCompany Theme JavaScript
 * Version: 3.0 – Minimalist Experience
 */
(function () {
    'use strict';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function whenReady(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback, { once: true });
        } else {
            callback();
        }
    }

    function manageHeroVideo() {
        const hero = document.querySelector('.hero');
        if (!hero) return;

        const video = hero.querySelector('video');
        if (!video) return;

        video.muted = true;

        const handlePlayback = (shouldPlay) => {
            if (prefersReducedMotion) return;
            if (shouldPlay) {
                const playPromise = video.play();
                if (playPromise) {
                    playPromise.catch(() => {
                        /* autoplay blocked */
                    });
                }
            } else {
                video.pause();
            }
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                handlePlayback(entry.isIntersecting);
            });
        }, { threshold: 0.35 });

        observer.observe(hero);
    }

    function initRevealAnimations() {
        const elements = document.querySelectorAll('.reveal');
        if (!elements.length || prefersReducedMotion) {
            elements.forEach((el) => el.classList.add('is-visible'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            rootMargin: '0px 0px -10% 0px',
            threshold: 0.2,
        });

        elements.forEach((el) => observer.observe(el));
    }

    function initBrandCards() {
        const cards = document.querySelectorAll('.brand-card');
        if (!cards.length) return;

        const isPointerFine = window.matchMedia('(pointer: fine)').matches;
        if (!isPointerFine) {
            cards.forEach((card) => card.classList.add('brand-card--touch'));
            return;
        }

        const handleMove = (event) => {
            const { currentTarget: card } = event;
            const rect = card.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            card.style.setProperty('--pointer-x', `${x}px`);
            card.style.setProperty('--pointer-y', `${y}px`);
        };

        cards.forEach((card) => {
            card.addEventListener('mousemove', handleMove);
            card.addEventListener('mouseleave', () => {
                card.style.removeProperty('--pointer-x');
                card.style.removeProperty('--pointer-y');
            });
        });
    }

    function initScrollHeader() {
        const header = document.querySelector('.site-header');
        if (!header) return;

        let previousScroll = window.pageYOffset;

        const onScroll = () => {
            const currentScroll = window.pageYOffset;
            const isPinned = currentScroll <= 64;
            const isScrollingUp = currentScroll < previousScroll;

            header.classList.toggle('is-scrolled', currentScroll > 0);
            header.classList.toggle('is-visible', isPinned || isScrollingUp);

            previousScroll = currentScroll;
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    whenReady(() => {
        manageHeroVideo();
        initRevealAnimations();
        initBrandCards();
        initScrollHeader();
    });
})();
