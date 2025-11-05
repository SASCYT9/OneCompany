/**
 * Premium Particles System
 * Elegant platinum/gold particles with optimized performance
 */

// Optimized particles configuration
const PARTICLES_CONFIG = {
    count: 15, // Reduced from 40
    size: { min: 0.5, max: 2 }, // Smaller, more elegant
    speed: { min: -0.15, max: 0.15 }, // Slower movement
    connection: {
        distance: 200,
        opacity: 0.15,
        lineWidth: 0.5
    },
    colors: {
        gold: 'rgba(201, 169, 97, 0.8)',
        silver: 'rgba(192, 192, 192, 0.2)'
    }
};

// Enhanced particle class
class PremiumParticle {
    constructor(canvas) {
        this.canvas = canvas;
        this.reset();
    }

    reset() {
        this.x = Math.random() * this.canvas.width;
        this.y = Math.random() * this.canvas.height;
        this.size = Math.random() * (PARTICLES_CONFIG.size.max - PARTICLES_CONFIG.size.min) + PARTICLES_CONFIG.size.min;
        this.speedX = Math.random() * (PARTICLES_CONFIG.speed.max - PARTICLES_CONFIG.speed.min) + PARTICLES_CONFIG.speed.min;
        this.speedY = Math.random() * (PARTICLES_CONFIG.speed.max - PARTICLES_CONFIG.speed.min) + PARTICLES_CONFIG.speed.min;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x < 0 || this.x > this.canvas.width) this.speedX *= -1;
        if (this.y < 0 || this.y > this.canvas.height) this.speedY *= -1;
    }

    draw(ctx) {
        // Elegant gradient particles
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
        gradient.addColorStop(0, PARTICLES_CONFIG.colors.gold);
        gradient.addColorStop(1, PARTICLES_CONFIG.colors.silver);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Initialize premium particle system
function initPremiumParticles() {
    const canvas = document.getElementById('particles');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    for (let i = 0; i < PARTICLES_CONFIG.count; i++) {
        particles.push(new PremiumParticle(canvas));
    }

    function connectParticles() {
        for (let a = 0; a < particles.length; a++) {
            for (let b = a + 1; b < particles.length; b++) {
                const dx = particles[a].x - particles[b].x;
                const dy = particles[a].y - particles[b].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < PARTICLES_CONFIG.connection.distance) {
                    const opacity = (1 - distance / PARTICLES_CONFIG.connection.distance) * PARTICLES_CONFIG.connection.opacity;
                    ctx.strokeStyle = `rgba(201, 169, 97, ${opacity})`;
                    ctx.lineWidth = PARTICLES_CONFIG.connection.lineWidth;
                    ctx.beginPath();
                    ctx.moveTo(particles[a].x, particles[a].y);
                    ctx.lineTo(particles[b].x, particles[b].y);
                    ctx.stroke();
                }
            }
        }
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        particles.forEach(particle => {
            particle.update();
            particle.draw(ctx);
        });
        
        connectParticles();
        requestAnimationFrame(animate);
    }

    animate();

    // Optimized resize handler
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            particles.forEach(p => p.reset());
        }, 250);
    });
}

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPremiumParticles);
} else {
    initPremiumParticles();
}
