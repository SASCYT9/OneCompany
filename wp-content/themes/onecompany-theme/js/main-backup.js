/**
 * OneCompany Theme JavaScript
 */

(function() {
    'use strict';

    // Navigation scroll effect
    const nav = document.getElementById('mainNav');
    if (nav) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 50) {
                nav.classList.add('scrolled');
            } else {
                nav.classList.remove('scrolled');
            }
        });
    }

    // Video section management
    const videoSections = document.querySelectorAll('.video-section');
    const sections = document.querySelectorAll('.product-section');
    let currentVideoIndex = 0;

    function updateVideos() {
        const scrollPosition = window.scrollY;
        const windowHeight = window.innerHeight;
        
        // Hero video
        const heroVideo = document.getElementById('hero-video');
        if (heroVideo) {
            const videoElement = heroVideo.querySelector('video');
            if (scrollPosition < windowHeight * 0.5) {
                heroVideo.style.opacity = '1';
                if (videoElement && videoElement.paused) {
                    videoElement.play().catch(() => {});
                }
            } else {
                heroVideo.style.opacity = '0';
                if (videoElement && !videoElement.paused) {
                    videoElement.pause();
                }
            }
        }

        // Product videos
        sections.forEach((section, index) => {
            const rect = section.getBoundingClientRect();
            const sectionTop = rect.top;
            const sectionBottom = rect.bottom;
            const isVisible = sectionTop < windowHeight * 0.7 && sectionBottom > windowHeight * 0.3;
            
            const brandIndex = index + 1;
            const videoSection = document.querySelector(`[data-brand-index="${brandIndex}"]`);
            
            if (videoSection) {
                const video = videoSection.querySelector('video');
                
                if (isVisible) {
                    videoSection.style.opacity = '1';
                    if (video && video.paused) {
                        video.play().catch(() => {});
                    }
                    currentVideoIndex = brandIndex;
                } else {
                    videoSection.style.opacity = '0';
                    if (video && !video.paused) {
                        video.pause();
                    }
                }
            }
        });
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href !== '#' && href !== '#!') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });

    // Initialize
    updateVideos();
    
    // Update on scroll (throttled)
    let ticking = false;
    window.addEventListener('scroll', function() {
        if (!ticking) {
            window.requestAnimationFrame(function() {
                updateVideos();
                ticking = false;
            });
            ticking = true;
        }
    });

    // Auto-play all videos on load
    window.addEventListener('load', function() {
        const allVideos = document.querySelectorAll('video');
        allVideos.forEach(video => {
            video.muted = true;
            video.play().catch(() => {});
        });
    });

})();
