'use client';

import { useEffect } from 'react';

export default function UrbanThemeScript({ homeId }: { homeId?: string }) {
  useEffect(() => {
    const HOME_ID = homeId || 'UrbanHomeV7';
    const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const loader = document.getElementById(HOME_ID + '-loader');
    if (loader) {
      const hide = () => {
        loader.classList.add('is-hidden');
        setTimeout(() => loader.remove(), 900);
      };
      setTimeout(hide, 2400);
      window.addEventListener('click', hide, { once: true });
      window.addEventListener('touchstart', hide, { once: true });
    }

    const progressBar = document.getElementById(HOME_ID + '-progress');
    if (progressBar) {
      const onScroll = () => {
        const p = document.documentElement.scrollHeight - window.innerHeight;
        (progressBar as HTMLElement).style.width = p > 0 ? (window.scrollY / p) * 100 + '%' : '0%';
      };
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    const uh7 = document.getElementById(HOME_ID);
    if (uh7) {
      uh7.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', (e) => {
          const href = (anchor as HTMLAnchorElement).getAttribute('href');
          if (href === '#' || !href) return;
          const el = document.getElementById(href.slice(1));
          if (el) {
            e.preventDefault();
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      });
    }

    document.querySelectorAll('[data-uh7-split]').forEach((el) => {
      const titleEl = el as HTMLElement;
      const shimmer = titleEl.querySelector('.uh7-hero__title-shimmer');
      const txt = (titleEl.childNodes[0]?.textContent || titleEl.textContent || '').trim();
      titleEl.innerHTML = '';
      let ci = 0;
      for (let i = 0; i < txt.length; i++) {
        if (txt[i] === ' ') {
          titleEl.appendChild(document.createTextNode(' '));
        } else {
          const s = document.createElement('span');
          s.className = 'uh7-char';
          s.textContent = txt[i];
          s.style.animationDelay = 0.8 + ci * 0.035 + 's';
          titleEl.appendChild(s);
          ci++;
        }
      }
      if (shimmer) titleEl.appendChild(shimmer);
    });

    const fitHeroTitle = () => {
      const hero = document.getElementById(HOME_ID + '-hero');
      if (!hero) return;
      const title = hero.querySelector('.uh7-hero__title') as HTMLElement;
      if (!title) return;
      const parent = title.parentElement;
      if (!parent) return;
      title.style.fontSize = '';
      let size = parseFloat(window.getComputedStyle(title).fontSize || '0');
      const min = window.innerWidth <= 749 ? 6 : 9;
      let guard = 0;
      while (title.scrollWidth > parent.clientWidth * 0.99 && size > min && guard < 220) {
        size -= 0.5;
        title.style.fontSize = size + 'px';
        guard++;
      }
    };
    fitHeroTitle();
    setTimeout(fitHeroTitle, 160);
    window.addEventListener('resize', () => requestAnimationFrame(fitHeroTitle), { passive: true });

    const ro = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-vis');
            ro.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -50px 0px' }
    );
    document.querySelectorAll('[data-uh7-reveal]').forEach((el) => ro.observe(el));

    const vimeoRo = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const iframe = e.target as HTMLIFrameElement;
            const src = iframe.getAttribute('data-src');
            if (src && !iframe.src) {
              iframe.src = src;
            }
            vimeoRo.unobserve(iframe);
          }
        });
      },
      { threshold: 0.1, rootMargin: '100px 0px' }
    );
    document.querySelectorAll('[data-uh7-vimeo]').forEach((el) => vimeoRo.observe(el));

    const defHero = document.getElementById(HOME_ID + '-def-hero');
    if (defHero) {
      const defObs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('is-visible');
              defObs.unobserve(e.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
      );
      defObs.observe(defHero);
    }

    if (!RM) {
      document.querySelectorAll('[data-uh7-tilt]').forEach((card) => {
        const inner = card.querySelector('.uh7-card__inner') as HTMLElement;
        const light = card.querySelector('.uh7-card__light') as HTMLElement;
        const lightWarm = card.querySelector('.uh7-card__light-warm') as HTMLElement;
        if (!inner) return;

        card.addEventListener('mouseenter', () => {
          inner.style.transition = 'transform .15s ease-out';
        });

        card.addEventListener('mousemove', (e: Event) => {
          const ev = e as MouseEvent;
          const r = (card as HTMLElement).getBoundingClientRect();
          const x = (ev.clientX - r.left) / r.width;
          const y = (ev.clientY - r.top) / r.height;
          const rx = ((0.5 - y) * 8).toFixed(2);
          const ry = ((x - 0.5) * 8).toFixed(2);
          inner.style.setProperty('--rx', rx + 'deg');
          inner.style.setProperty('--ry', ry + 'deg');
          if (light) {
            light.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
            light.style.setProperty('--my', (y * 100).toFixed(1) + '%');
          }
          if (lightWarm) {
            lightWarm.style.setProperty('--mx2', ((1 - x) * 80 + 10).toFixed(1) + '%');
            lightWarm.style.setProperty('--my2', ((1 - y) * 70 + 15).toFixed(1) + '%');
          }
        });

        card.addEventListener('mouseleave', () => {
          inner.style.transition = 'transform .6s cubic-bezier(.34,1.56,.64,1)';
          inner.style.setProperty('--rx', '0deg');
          inner.style.setProperty('--ry', '0deg');
          setTimeout(() => {
            inner.style.transition = 'transform .15s ease-out';
          }, 600);
        });
      });
    }

    if (!RM) {
      const hp = document.querySelector('[data-uh7-parallax="hero"]') as HTMLElement;
      const scImgs = document.querySelectorAll('[data-uh7-parallax="sc"]');
      let ticking = false;
      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          const sy = window.scrollY;
          if (hp) hp.style.transform = 'translateY(' + sy * 0.3 + 'px)';
          scImgs.forEach((img) => {
            const sc = (img as HTMLElement).closest('.uh7-sc');
            if (!sc) return;
            const r = sc.getBoundingClientRect();
            const vh = window.innerHeight;
            if (r.bottom > 0 && r.top < vh) {
              const p = (vh - r.top) / (vh + r.height);
              (img as HTMLElement).style.transform = 'translateY(' + (p - 0.5) * -80 + 'px)';
            }
          });
          ticking = false;
        });
      };
      window.addEventListener('scroll', onScroll, { passive: true });
    }
  }, []);

  return null;
}
