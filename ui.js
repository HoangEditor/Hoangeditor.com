/* ═══════════════════════════════════════════════════════════════
   Hoang Editor — Premium Animation Engine
   GSAP + ScrollTrigger for Apple-like motion
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Bootstrap: wait for GSAP ──────────────────────────── */
  function whenReady(fn) {
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      fn();
      return;
    }
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        clearInterval(t);
        fn();
      } else if (tries > 80) {
        clearInterval(t);
        fallback();
      }
    }, 120);
  }

  /* ── Fallback (no GSAP) ────────────────────────────────── */
  function fallback() {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

    document.querySelectorAll('[data-count]').forEach(el => {
      const target = parseInt(el.getAttribute('data-count'), 10);
      if (!target) return;
      const co = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          animateCount(el, 0, target, 2000);
          co.unobserve(el);
        }
      }, { threshold: 0.5 });
      co.observe(el);
    });

    initFaqAccordion();
    initMobileMenu();
    initSmoothScroll();
    initHeaderScroll();
    initCardTilt();
  }

  function animateCount(el, from, to, duration) {
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const v = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * v);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = to;
    }
    requestAnimationFrame(tick);
  }

  /* ── Main ───────────────────────────────────────────────── */
  function main() {
    gsap.registerPlugin(ScrollTrigger);

    initTheme();
    initHeaderScroll();
    initHeroAnimation();
    initHeroParallax();
    initScrollReveals();
    initStatsCounter();
    initCardTilt();
    initPricingReveal();
    initFaqAccordion();
    initMobileMenu();
    initSmoothScroll();
  }

  /* ═══════════════════════════════════════════════════════════
     HEADER SCROLL
     ═══════════════════════════════════════════════════════════ */

  function initHeaderScroll() {
    const header = document.querySelector('.site-header');
    if (!header) return;

    const onScroll = () => {
      header.classList.toggle('scrolled', window.scrollY > 40);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ═══════════════════════════════════════════════════════════
     HERO — Staggered Text Reveal
     ═══════════════════════════════════════════════════════════ */

  function initHeroAnimation() {
    const lines = document.querySelectorAll('.hero-title .line-inner');
    const desc = document.querySelector('.hero-desc');
    const actions = document.querySelector('.hero-actions');
    const badge = document.querySelector('.hero-badge');
    const heroTrust = document.querySelector('.hero-trust');
    const scrollHint = document.querySelector('.scroll-hint');

    if (!lines.length) return;

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: 0.3 });

    tl.to(lines, {
      y: '0%',
      opacity: 1,
      duration: 1.1,
      stagger: 0.18,
    });

    if (badge) {
      tl.to(badge, { opacity: 1, y: 0, duration: 0.7 }, '-=1.2');
    }

    if (heroTrust) {
      tl.to(heroTrust, { opacity: 1, y: 0, duration: 0.7 }, '-=0.3');
    }

    if (desc) {
      tl.to(desc, { opacity: 1, y: 0, duration: 0.75 }, '-=0.4');
    }

    if (actions) {
      tl.to(actions, { opacity: 1, y: 0, duration: 0.75 }, '-=0.35');
    }

    if (scrollHint) {
      tl.to(scrollHint, { opacity: 1, duration: 0.6 }, '-=0.2');
    }
  }

  /* ═══════════════════════════════════════════════════════════
     HERO PARALLAX — subtle scale + translate on scroll
     ═══════════════════════════════════════════════════════════ */

  function initHeroParallax() {
    const content = document.querySelector('.hero-content');
    if (!content) return;

    gsap.to(content, {
      y: 60,
      scale: 0.96,
      opacity: 0.4,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        end: 'bottom top',
        scrub: 0.6,
      },
    });
  }

  /* ═══════════════════════════════════════════════════════════
     SCROLL REVEALS
     ═══════════════════════════════════════════════════════════ */

  function initScrollReveals() {
    const reveals = document.querySelectorAll('.reveal');

    reveals.forEach(el => {
      ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        once: true,
        onEnter: () => {
          gsap.to(el, {
            opacity: 1,
            y: 0,
            duration: 0.85,
            delay: el.dataset.delay ? parseFloat(el.dataset.delay) : 0,
            ease: 'power3.out',
          });
          el.classList.add('visible');
        },
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     STATS COUNTER
     ═══════════════════════════════════════════════════════════ */

  function initStatsCounter() {
    const counters = document.querySelectorAll('[data-count]');
    counters.forEach(el => {
      const target = parseInt(el.getAttribute('data-count'), 10);
      if (!target) return;

      ScrollTrigger.create({
        trigger: '.stats-bar',
        start: 'top 82%',
        once: true,
        onEnter: () => {
          gsap.fromTo(el,
            { textContent: 0 },
            {
              textContent: target,
              duration: 2,
              ease: 'power2.out',
              snap: { textContent: 1 },
              onUpdate() {
                el.textContent = Math.round(this.targets()[0].textContent);
              },
            }
          );
        },
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     3D CARD TILT
     ═══════════════════════════════════════════════════════════ */

  function initCardTilt() {
    const cards = document.querySelectorAll('.card, .price-card, .step-card, .testimonial-card');

    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        card.style.setProperty('--mx', (x / rect.width * 100) + '%');
        card.style.setProperty('--my', (y / rect.height * 100) + '%');

        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const rotY = ((x - cx) / cx) * 4;
        const rotX = ((cy - y) / cy) * 4;

        card.style.transform =
          `perspective(1200px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-2px) scale3d(1.008,1.008,1.008)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.setProperty('--mx', '50%');
        card.style.setProperty('--my', '50%');
        card.style.transition = 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.4s ease, box-shadow 0.4s ease';
        card.style.transform =
          'perspective(1200px) rotateX(0deg) rotateY(0deg) translateY(0px) scale3d(1,1,1)';
      });

      card.addEventListener('mouseenter', () => {
        card.style.transition = 'transform 0.1s ease-out, border-color 0.4s ease, box-shadow 0.4s ease';
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     PRICING CARDS — stagger reveal
     ═══════════════════════════════════════════════════════════ */

  function initPricingReveal() {
    const cards = document.querySelectorAll('.price-card');
    if (!cards.length) return;

    ScrollTrigger.create({
      trigger: '.pricing-grid',
      start: 'top 84%',
      once: true,
      onEnter: () => {
        gsap.fromTo(cards,
          { y: 40, opacity: 0, scale: 0.96 },
          {
            y: 0, opacity: 1, scale: 1,
            duration: 0.75,
            stagger: 0.12,
            ease: 'power3.out',
          }
        );
      },
    });
  }

  /* ═══════════════════════════════════════════════════════════
     MOBILE MENU
     ═══════════════════════════════════════════════════════════ */

  function initMobileMenu() {
    const toggle = document.querySelector('.menu-toggle');
    const menu = document.querySelector('.mobile-menu');
    if (!toggle || !menu) return;

    let open = false;

    function show() {
      open = true;
      menu.classList.add('open');
      toggle.innerHTML = '<i class="fas fa-times"></i>';
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }

    function hide() {
      open = false;
      menu.classList.remove('open');
      toggle.innerHTML = '<i class="fas fa-bars"></i>';
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    toggle.addEventListener('click', () => open ? hide() : show());

    menu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => { if (open) hide(); });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && open) hide();
    });
  }

  /* ═══════════════════════════════════════════════════════════
     FAQ ACCORDION
     ═══════════════════════════════════════════════════════════ */

  function initFaqAccordion() {
    const triggers = document.querySelectorAll('.faq-trigger');
    triggers.forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        const isOpen = item.classList.contains('open');

        // Close all others
        document.querySelectorAll('.faq-item.open').forEach(el => {
          if (el !== item) {
            el.classList.remove('open');
            el.querySelector('.faq-trigger').setAttribute('aria-expanded', 'false');
          }
        });

        // Toggle current
        if (isOpen) {
          item.classList.remove('open');
          btn.setAttribute('aria-expanded', 'false');
        } else {
          item.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     SMOOTH SCROLL FOR ANCHOR LINKS
     ═══════════════════════════════════════════════════════════ */

  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (!href || href === '#') return;

        const target = document.querySelector(href);
        if (!target) return;

        e.preventDefault();

        const offset = 80;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;

        window.scrollTo({ top, behavior: 'smooth' });
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     THEME TOGGLE
     ═══════════════════════════════════════════════════════════ */

  function initTheme() {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    const html = document.documentElement;
    const icon = toggle.querySelector('i');

    // Default to light mode (no data-theme attribute)
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      html.setAttribute('data-theme', 'dark');
      icon.className = 'fas fa-sun';
    }

    function switchTheme() {
      const isDark = html.getAttribute('data-theme') === 'dark';
      if (isDark) {
        html.removeAttribute('data-theme');
        icon.className = 'fas fa-moon';
        localStorage.setItem('theme', 'light');
      } else {
        html.setAttribute('data-theme', 'dark');
        icon.className = 'fas fa-sun';
        localStorage.setItem('theme', 'dark');
      }
    }

    toggle.addEventListener('click', switchTheme);
  }

  /* ═══════════════════════════════════════════════════════════
     BOOT
     ═══════════════════════════════════════════════════════════ */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => whenReady(main));
  } else {
    whenReady(main);
  }
})();
