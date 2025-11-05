/**
 * OneCompany EPIC Theme JavaScript v2.0
 * Features: GSAP, Particles, Ken Burns, Spotlight, Custom Cursor
 */

(function() {
    'use strict';

    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    const hasPointer = window.matchMedia("(pointer: fine)").matches;

    gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, Observer);

    // ===== DYNAMIC ACCENT COLOR =====
    function updateAccentColor(hex) {
        if (!hex) hex = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        document.documentElement.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
    }
    updateAccentColor();

    // ===== PRELOADER =====
    const preloader = document.querySelector('.epic-preloader');
    const preloaderProgress = document.querySelector('.epic-preloader__progress');
    const preloaderPercent = document.querySelector('.epic-preloader__percent');

    let progress = 0;
    const progressInterval = setInterval(() => {
        let randomAmount = progress < 30 ? Math.random() * 5 :
                          progress < 70 ? Math.random() * 10 :
                          progress < 90 ? Math.random() * 3 : Math.random() * 1;
        progress += randomAmount;
        if (progress > 100) progress = 100;

        if (preloaderProgress) preloaderProgress.style.width = progress + '%';
        if (preloaderPercent) preloaderPercent.textContent = Math.floor(progress) + '%';

        if (progress >= 100) {
            clearInterval(progressInterval);
            setTimeout(() => {
                gsap.to(preloader, {
                    opacity: 0,
                    duration: 0.8,
                    ease: 'power3.inOut',
                    onComplete: () => {
                        if (preloader) preloader.style.display = 'none';
                        if (isDesktop) {
                            document.body.classList.add('desktop-scroll-active');
                            initDesktopScroll();
                        } else {
                            initMobileScroll();
                        }
                        startMainAnimations();
                    }
                });
            }, 500);
        }
    }, 80);

    // ===== CUSTOM CURSOR ===== 
    let mouseX = 0, mouseY = 0;
    let cursorX = 0, cursorY = 0;
    let ringX = 0, ringY = 0;
    const trails = [];
    const trailCount = 8;

    if (isDesktop && hasPointer) {
        const cursor = document.querySelector('.epic-cursor');
        const cursorRing = document.querySelector('.epic-cursor-ring');
        const tooltip = document.querySelector('.nav-tooltip');

        for (let i = 0; i < trailCount; i++) {
            const trail = document.createElement('div');
            trail.className = 'cursor-trail';
            document.body.appendChild(trail);
            trails.push({ element: trail, x: 0, y: 0 });
        }

        function animateCursor() {
            cursorX += (mouseX - cursorX) * 0.2;
            cursorY += (mouseY - cursorY) * 0.2;
            ringX += (mouseX - ringX) * 0.1;
            ringY += (mouseY - ringY) * 0.1;

            if (cursor) cursor.style.transform = `translate(${cursorX}px, ${cursorY}px) translate(-50%, -50%)`;
            if (cursorRing) cursorRing.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;

            trails.forEach((trail, i) => {
                const targetX = i === 0 ? cursorX : trails[i - 1].x;
                const targetY = i === 0 ? cursorY : trails[i - 1].y;
                trail.x += (targetX - trail.x) * (0.1 - i * 0.01);
                trail.y += (targetY - trail.y) * (0.1 - i * 0.01);
                trail.element.style.transform = `translate(${trail.x}px, ${trail.y}px) translate(-50%, -50%) scale(${(trailCount - i) / trailCount})`;
                trail.element.style.opacity = (trailCount - i) / trailCount * 0.5;
            });

            requestAnimationFrame(animateCursor);
        }

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;

            if (tooltip && tooltip.classList.contains('visible')) {
                tooltip.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(20px, -40px) scale(1)`;
            }

            // Spotlight effect
            const overlays = document.querySelectorAll('.spotlight-active');
            overlays.forEach(overlay => {
                const rect = overlay.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                overlay.style.setProperty('--mouse-x', x + '%');
                overlay.style.setProperty('--mouse-y', y + '%');
            });
        });

        animateCursor();

        // Magnetic effect
        document.querySelectorAll('a, button, .nav-dot, .epic-intro__scroll, .sound-toggle').forEach(el => {
            el.addEventListener('mouseenter', () => {
                if (cursor) cursor.classList.add('magnetic');
                if (cursorRing) cursorRing.classList.add('magnetic');
            });

            el.addEventListener('mouseleave', () => {
                if (cursor) cursor.classList.remove('magnetic');
                if (cursorRing) cursorRing.classList.remove('magnetic');
                gsap.to(el, { x: 0, y: 0, duration: 0.3, ease: 'power2.out' });
            });

            el.addEventListener('mousemove', (e) => {
                const rect = el.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                gsap.to(el, { x: x * 0.3, y: y * 0.3, duration: 0.3, ease: 'power2.out' });
            });
        });

        // Tooltip
        if (tooltip) {
            document.querySelectorAll('.nav-dot').forEach(dot => {
                dot.addEventListener('mouseenter', () => {
                    const title = dot.getAttribute('data-title');
                    if (title) {
                        tooltip.textContent = title;
                        tooltip.classList.add('visible');
                        tooltip.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(20px, -40px) scale(1)`;
                    }
                });
                dot.addEventListener('mouseleave', () => {
                    tooltip.classList.remove('visible');
                    tooltip.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(20px, -40px) scale(0.8)`;
                });
            });
        }

        // Kinetic parallax
        document.addEventListener('mousemove', (e) => {
            const relX = (e.clientX - window.innerWidth / 2) / window.innerWidth;
            const relY = (e.clientY - window.innerHeight / 2) / window.innerHeight;

            gsap.to('.epic-intro__content', {
                x: -relX * 50,
                y: -relY * 30,
                duration: 1,
                ease: 'power1.out'
            });

            const activeSlide = document.querySelector('.epic-slide.active');
            if (activeSlide) {
                const content = activeSlide.querySelector('.epic-slide__content');
                if (content) {
                    gsap.to(content, {
                        x: -relX * 50,
                        y: -relY * 30,
                        duration: 1,
                        ease: 'power1.out'
                    });
                }
            }
        });

        // Enable spotlight
        document.querySelectorAll('.epic-intro__overlay, .epic-slide__overlay').forEach(el => {
            el.classList.add('spotlight-active');
        });
    }

    // ===== PARTICLES =====
    const canvasParticles = document.querySelector('.epic-intro__particles');
    let ctxParticles, particleAnimationId;
    const particles = [];
    const particleCount = 40;

    if (canvasParticles) {
        ctxParticles = canvasParticles.getContext('2d');

        function resizeParticlesCanvas() {
            canvasParticles.width = window.innerWidth;
            canvasParticles.height = window.innerHeight;
        }
        resizeParticlesCanvas();
        window.addEventListener('resize', resizeParticlesCanvas);

        class Particle {
            constructor() { this.reset(); }
            reset() {
                this.x = Math.random() * canvasParticles.width;
                this.y = Math.random() * canvasParticles.height;
                this.size = Math.random() * 2.5 + 0.5;
                this.speedX = (Math.random() - 0.5) * 0.4;
                this.speedY = (Math.random() - 0.5) * 0.4;
                this.opacity = Math.random() * 0.6 + 0.2;
                this.isAccent = Math.random() > 0.9;
            }
            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                if (this.x < 0 || this.x > canvasParticles.width) this.speedX *= -1;
                if (this.y < 0 || this.y > canvasParticles.height) this.speedY *= -1;

                if (isDesktop) {
                    const dx = mouseX - this.x;
                    const dy = mouseY - this.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < 100) {
                        this.x -= dx / distance * 2;
                        this.y -= dy / distance * 2;
                    }
                }
            }
            draw() {
                if (this.isAccent) {
                    ctxParticles.fillStyle = `rgba(var(--accent-rgb), ${this.opacity * 0.8})`;
                } else {
                    ctxParticles.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
                }
                ctxParticles.beginPath();
                ctxParticles.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctxParticles.fill();
            }
        }

        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }

        function animateParticles() {
            ctxParticles.clearRect(0, 0, canvasParticles.width, canvasParticles.height);
            particles.forEach(p => { p.update(); p.draw(); });
            particles.forEach((p1, i) => {
                particles.slice(i + 1).forEach(p2 => {
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < 120) {
                        if (p1.isAccent || p2.isAccent) {
                            ctxParticles.strokeStyle = `rgba(var(--accent-rgb), ${0.1 * (1 - distance / 120)})`;
                        } else {
                            ctxParticles.strokeStyle = `rgba(255, 255, 255, ${0.15 * (1 - distance / 120)})`;
                        }
                        ctxParticles.lineWidth = 0.5;
                        ctxParticles.beginPath();
                        ctxParticles.moveTo(p1.x, p1.y);
                        ctxParticles.lineTo(p2.x, p2.y);
                        ctxParticles.stroke();
                    }
                });
            });
            particleAnimationId = requestAnimationFrame(animateParticles);
        }
    }

    // ===== MAIN ANIMATIONS =====
    function startMainAnimations() {
        const titleWords = document.querySelectorAll('.epic-intro__title-word');
        titleWords.forEach(word => {
            const text = word.textContent.trim();
            word.innerHTML = '';
            text.split('').forEach(char => {
                const span = document.createElement('span');
                span.className = 'epic-intro__title-char';
                span.textContent = char === ' ' ? '\u00A0' : char;
                word.appendChild(span);
            });
        });

        const introTl = gsap.timeline({ delay: 0.3 });
        introTl
            .to('.epic-intro__label', { opacity: 1, duration: 1, ease: 'power3.out' })
            .to('.epic-intro__title-char', {
                y: '0%',
                rotateX: 0,
                opacity: 1,
                stagger: { each: 0.03, from: 'start' },
                duration: 1.2,
                ease: 'power4.out'
            }, '-=0.5')
            .to('.epic-intro__subtitle', { opacity: 1, duration: 1, ease: 'power3.out' }, '-=0.8')
            .to('.epic-intro__stats', { opacity: 1, duration: 1, ease: 'power3.out' }, '-=0.5')
            .add(() => animateCounters(), '-=0.3')
            .to('.epic-intro__scroll', { opacity: 1, duration: 0.8, ease: 'power3.out' }, '-=0.3');

        if (isDesktop) {
            introTl.to('.epic-intro__scroll', {
                scale: 1.05,
                repeat: -1,
                yoyo: true,
                duration: 1.5,
                ease: 'power1.inOut'
            }, '-=1');
        }
    }

    // ===== COUNTERS =====
    function animateCounters() {
        document.querySelectorAll('.epic-stat').forEach((stat, index) => {
            const numberEl = stat.querySelector('.epic-stat__number');
            const target = stat.getAttribute('data-count');
            if (!numberEl || !target) return;

            const targetNum = parseInt(target.replace('+', '')) || 0;
            const hasPlus = target.includes('+');

            let counter = { value: 0 };
            gsap.to(counter, {
                value: targetNum,
                duration: 2.5,
                ease: 'power3.out',
                delay: index * 0.1,
                onUpdate: () => {
                    numberEl.textContent = Math.floor(counter.value) + (hasPlus ? '+' : '');
                }
            });

            gsap.to(stat, {
                scrollTrigger: {
                    trigger: stat,
                    start: 'top 90%',
                    toggleActions: 'play none none none',
                    scroller: isDesktop ? 'body' : window,
                },
                onComplete: () => stat.classList.add('active'),
                delay: index * 0.2
            });
        });
    }

    // ===== SLIDES =====
    const slides = gsap.utils.toArray(".epic-intro, .epic-slide");
    const wrapper = document.querySelector(".epic-slides-wrapper");
    const progressFill = document.querySelector('.progress-bar__fill');
    const counterCurrent = document.querySelector('.slide-counter__current');
    const navDots = document.querySelectorAll('.nav-dot');
    const totalSlides = slides.length;
    let currentSlide = 0;
    let isAnimating = false;

    // ===== DESKTOP SCROLL =====
    function initDesktopScroll() {
        gsap.set(wrapper, { y: 0 });

        function gotoSlide(index) {
            index = gsap.utils.clamp(0, totalSlides - 1, index);
            if (isAnimating || index === currentSlide) return;
            isAnimating = true;

            const targetY = -index * window.innerHeight;
            gsap.to(wrapper, {
                y: targetY,
                duration: 1.4,
                ease: 'power3.inOut',
                onComplete: () => { isAnimating = false; }
            });

            updateSlideUI(index);
        }

        Observer.create({
            target: window,
            type: "wheel,touch,pointer",
            wheelSpeed: -1,
            onUp: () => !isAnimating && gotoSlide(currentSlide + 1),
            onDown: () => !isAnimating && gotoSlide(currentSlide - 1),
            tolerance: 10,
            preventDefault: true
        });

        navDots.forEach((dot, index) => {
            dot.addEventListener('click', () => gotoSlide(index));
        });

        const introScroll = document.querySelector('.epic-intro__scroll');
        if (introScroll) {
            introScroll.addEventListener('click', () => gotoSlide(1));
        }

        if (slides.length > 0) triggerSlideAnimations(slides[0]);
    }

    // ===== MOBILE SCROLL =====
    function initMobileScroll() {
        ScrollTrigger.create({
            trigger: wrapper,
            start: "top top",
            end: "bottom bottom",
            onUpdate: (self) => {
                gsap.to(progressFill, {
                    width: self.progress * 100 + '%',
                    ease: 'none'
                });
            }
        });

        slides.forEach((slide, index) => {
            const video = slide.querySelector('.epic-intro__video, .epic-slide__video');
            if (video) {
                gsap.to(video, {
                    yPercent: -20,
                    ease: "none",
                    scrollTrigger: {
                        trigger: slide,
                        start: "top bottom",
                        end: "bottom top",
                        scrub: true
                    }
                });
            }

            if (slide.classList.contains('epic-intro')) {
                gsap.to('.epic-intro__content', {
                    opacity: 0,
                    ease: "none",
                    scrollTrigger: {
                        trigger: slide,
                        start: "top top",
                        end: "50% top",
                        scrub: true
                    }
                });
            }

            const number = slide.querySelector('.epic-slide__number');
            const title = slide.querySelector('.epic-slide__title');
            const divider = slide.querySelector('.epic-slide__divider');
            const description = slide.querySelector('.epic-slide__description');

            if (title) {
                const contentTl = gsap.timeline({
                    scrollTrigger: {
                        trigger: slide,
                        start: "top 60%",
                        toggleActions: "play none none none"
                    }
                });

                gsap.set(number, { opacity: 0, y: 20 });
                gsap.set(title, { opacity: 1, y: 50, clipPath: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)' });
                gsap.set(description, { opacity: 1, y: 20, clipPath: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)' });
                gsap.set(divider, { opacity: 0, scaleX: 0 });

                contentTl
                    .to(number, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' })
                    .to(title, { y: 0, clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)', duration: 1, ease: 'power4.out' }, '-=0.5')
                    .to(divider, { opacity: 1, scaleX: 1, duration: 1.2, ease: 'elastic.out(1, 0.5)' }, '-=0.7')
                    .to(description, { y: 0, clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)', duration: 1, ease: 'power3.out' }, '-=0.5');
            }

            ScrollTrigger.create({
                trigger: slide,
                start: "top 50%",
                end: "bottom 50%",
                onEnter: () => updateSlideUI(index),
                onEnterBack: () => updateSlideUI(index)
            });
        });

        navDots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                gsap.to(window, {
                    scrollTo: { y: slides[index], offsetY: 0 },
                    duration: 1.2,
                    ease: 'power3.inOut'
                });
            });
        });

        const introScroll = document.querySelector('.epic-intro__scroll');
        if (introScroll) {
            introScroll.addEventListener('click', () => {
                gsap.to(window, {
                    scrollTo: { y: slides[1], offsetY: 0 },
                    duration: 1.2,
                    ease: 'power3.inOut'
                });
            });
        }

        if (slides.length > 0) triggerSlideAnimations(slides[0]);
    }

    // ===== UPDATE UI =====
    function updateSlideUI(index) {
        if (currentSlide === index && !isDesktop) return;
        if (isDesktop && currentSlide === index) return;

        // Remove active from all slides
        slides.forEach(s => s.classList.remove('active'));
        if (slides[index]) slides[index].classList.add('active');

        currentSlide = index;

        const displayIndex = index + 1;
        if (counterCurrent) {
            counterCurrent.textContent = displayIndex < 10 ? '0' + displayIndex : displayIndex;
        }

        navDots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });

        if (isDesktop) {
            gsap.to(progressFill, {
                width: (index / (totalSlides - 1)) * 100 + '%',
                duration: 0.5,
                ease: 'power2.out'
            });
        }

        if (isDesktop) {
            gsap.to('.epic-slide__content', { x: 0, y: 0, duration: 0.5, ease: 'power1.out' });
        }

        // Update accent color based on slide
        if (slides[index]) {
            const accentColor = slides[index].getAttribute('data-accent');
            if (accentColor) {
                document.documentElement.style.setProperty('--accent', accentColor);
                updateAccentColor(accentColor);
            }
        }

        if (slides[index]) triggerSlideAnimations(slides[index]);
    }

    // ===== SLIDE ANIMATIONS =====
    function triggerSlideAnimations(slide) {
        if (!slide) return;

        // Stop all videos
        document.querySelectorAll('video').forEach(v => {
            v.pause();
            gsap.set(v, { scale: 1.1, duration: 0.1 });
        });

        // Particles
        if (slide.classList.contains('epic-intro')) {
            if (!particleAnimationId && canvasParticles) animateParticles();
        } else {
            if (particleAnimationId) {
                cancelAnimationFrame(particleAnimationId);
                particleAnimationId = null;
            }
        }

        // Start active video
        const activeVideo = slide.querySelector('video');
        if (activeVideo) {
            if (activeVideo.readyState >= 3) {
                activeVideo.play().catch(e => {});
                gsap.to(activeVideo, { scale: 1, duration: 10, ease: 'none' });
            } else {
                activeVideo.addEventListener('canplay', () => {
                    activeVideo.play().catch(e => {});
                    gsap.to(activeVideo, { scale: 1, duration: 10, ease: 'none' });
                }, { once: true });
            }
        }

        // Desktop content animations
        if (isDesktop) {
            const number = slide.querySelector('.epic-slide__number');
            const title = slide.querySelector('.epic-slide__title');
            const divider = slide.querySelector('.epic-slide__divider');
            const description = slide.querySelector('.epic-slide__description');

            if (title) {
                gsap.set(number, { opacity: 0, y: 20 });
                gsap.set(title, { opacity: 1, y: 50, clipPath: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)' });
                gsap.set(description, { opacity: 1, y: 20, clipPath: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)' });
                gsap.set(divider, { opacity: 0, scaleX: 0 });

                const contentTl = gsap.timeline({ delay: 0.5 });
                contentTl
                    .to(number, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' })
                    .to(title, { y: 0, clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)', duration: 1, ease: 'power4.out' }, '-=0.5')
                    .to(divider, { opacity: 1, scaleX: 1, duration: 1.2, ease: 'elastic.out(1, 0.5)' }, '-=0.7')
                    .to(description, { y: 0, clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)', duration: 1, ease: 'power3.out' }, '-=0.5');
            }
        }
    }

    // ===== SOUND TOGGLE =====
    const soundToggle = document.querySelector('.sound-toggle');
    let soundEnabled = false;

    if (soundToggle) {
        soundToggle.addEventListener('click', () => {
            soundEnabled = !soundEnabled;
            soundToggle.classList.toggle('muted', !soundEnabled);
            document.querySelectorAll('video').forEach(video => {
                video.muted = !soundEnabled;
            });
        });
    }

    document.querySelectorAll('video').forEach(video => {
        video.muted = !soundEnabled;
    });

    // ===== NAVIGATION SCROLL =====
    const nav = document.querySelector('.epic-nav');
    if (nav) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 50) {
                nav.classList.add('scrolled');
            } else {
                nav.classList.remove('scrolled');
            }
        });
    }

})();
