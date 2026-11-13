(function () {
  'use strict';

  /* ------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------ */
  const selectOne = (selector, scope = document) => scope.querySelector(selector);
  const selectAll = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasFinePointer = window.matchMedia('(hover: hover)').matches;
  const easeOutCubic = (progress) => 1 - Math.pow(1 - progress, 3);

  const rootElement = document.documentElement;

  /* ------------------------------------------------------------------
     Theme toggle (the saved theme is applied in <head> before first paint)
     ------------------------------------------------------------------ */
  function initThemeToggle() {
    const themeToggleButton = selectOne('#themeToggle');
    if (!themeToggleButton) return;

    themeToggleButton.addEventListener('click', () => {
      const nextTheme = rootElement.dataset.theme === 'dark' ? 'light' : 'dark';
      rootElement.dataset.theme = nextTheme;
      try {
        localStorage.setItem('theme', nextTheme);
      } catch (error) { /* storage unavailable, theme just will not persist */ }
    });
  }

  /* ------------------------------------------------------------------
     Preloader
     ------------------------------------------------------------------ */
  function initPreloader(onFinished) {
    const preloaderElement = selectOne('#preloader');

    // Pages without a preloader, or a visitor who has already seen it this
    // session, go straight to the content.
    let alreadySeen = false;
    try { alreadySeen = sessionStorage.getItem('preloaderSeen') === '1'; } catch (error) { /* ignore */ }

    if (!preloaderElement || alreadySeen) {
      if (preloaderElement) preloaderElement.remove();
      document.body.classList.remove('is-locked');
      // wait a frame so the entrance transitions can play
      requestAnimationFrame(() => requestAnimationFrame(onFinished));
      return;
    }

    const timelineItems = selectAll('.preloader__item', preloaderElement);
    const counterElement = selectOne('#preloaderCounter');
    const barFillElement = selectOne('#preloaderBarFill');

    const durationInMs = prefersReducedMotion ? 800 : 3800;
    const startTime = performance.now();

    function updateFrame(currentTime) {
      const progress = Math.min((currentTime - startTime) / durationInMs, 1);
      const percentage = Math.round(easeOutCubic(progress) * 100);

      counterElement.textContent = percentage;
      barFillElement.style.width = percentage + '%';

      timelineItems.forEach((item, index) => {
        if (percentage >= index * 22 + 8) {
          item.classList.add('preloader__item--visible');
        }
      });

      if (progress < 1) {
        requestAnimationFrame(updateFrame);
        return;
      }

      setTimeout(() => {
        preloaderElement.classList.add('preloader--done');
        document.body.classList.remove('is-locked');
        try { sessionStorage.setItem('preloaderSeen', '1'); } catch (error) { /* ignore */ }
        onFinished();
      }, 350);
    }

    requestAnimationFrame(updateFrame);
  }

  /* ------------------------------------------------------------------
     Scroll reveal and animated counters
     ------------------------------------------------------------------ */
  function initScrollReveal() {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('reveal--visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.15 });

    selectAll('.reveal').forEach((element, index) => {
      const isInStaggeredGroup = element.closest('.stats-grid, .stack-grid, .principles__grid, .explore-grid, .hobby-grid, .goal-list');
      const staggerDelayInMs = isInStaggeredGroup ? (index % 4) * 90 : 0;
      element.style.transitionDelay = staggerDelayInMs + 'ms';
      revealObserver.observe(element);
    });
  }

  function initCounters() {
    const counterElements = selectAll('[data-count-to]');
    const runningAnimations = new WeakMap();

    function animateCounter(counterElement) {
      const targetValue = Number(counterElement.dataset.countTo);
      const suffix = counterElement.dataset.countSuffix || '';
      const animationStart = performance.now();
      runningAnimations.set(counterElement, animationStart);

      function updateFrame(currentTime) {
        if (runningAnimations.get(counterElement) !== animationStart) return;
        const progress = Math.min((currentTime - animationStart) / 1800, 1);
        counterElement.textContent = Math.round(easeOutCubic(progress) * targetValue) + suffix;
        if (progress < 1) requestAnimationFrame(updateFrame);
      }

      requestAnimationFrame(updateFrame);
    }

    function resetCounter(counterElement) {
      runningAnimations.set(counterElement, 0);
      counterElement.textContent = '0' + (counterElement.dataset.countSuffix || '');
    }

    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) animateCounter(entry.target);
        else resetCounter(entry.target);
      });
    }, { threshold: 0.7 });

    counterElements.forEach((counterElement) => counterObserver.observe(counterElement));
  }

  /* ------------------------------------------------------------------
     Animated vertical guide lines
     ------------------------------------------------------------------ */
  function initGuideLines() {
    const LINES_PER_SECTION = 5;

    selectAll('[data-guide-lines]').forEach((sectionElement) => {
      const guideLinesElement = document.createElement('div');
      guideLinesElement.className = 'guide-lines';
      guideLinesElement.setAttribute('aria-hidden', 'true');
      guideLinesElement.innerHTML = '<span class="guide-line"></span>'.repeat(LINES_PER_SECTION);
      sectionElement.prepend(guideLinesElement);
    });

    // Keep the trail speed constant regardless of section height.
    function updateTrailDurations() {
      selectAll('.guide-lines').forEach((guideLinesElement) => {
        const sectionHeight = guideLinesElement.parentElement.offsetHeight;
        const durationInSeconds = Math.max(2.2, sectionHeight / 400);
        guideLinesElement.style.setProperty('--guide-line-duration', durationInSeconds + 's');
      });
    }

    updateTrailDurations();
    window.addEventListener('load', updateTrailDurations);
    window.addEventListener('resize', updateTrailDurations);
  }

  /* ------------------------------------------------------------------
     Cursor, parallax, hero tilt and magnetic buttons (one animation loop)
     ------------------------------------------------------------------ */
  function initPointerEffects() {
    const cursorElement = selectOne('#cursor');
    if (!cursorElement) return;
    const heroVisualElement = selectOne('#heroVisual');
    const parallaxElements = selectAll('[data-parallax-speed]');

    let pointerX = 0;
    let pointerY = 0;
    let cursorX = window.innerWidth / 2;
    let cursorY = window.innerHeight / 2;
    let normalizedPointerX = 0;
    let normalizedPointerY = 0;
    let smoothedPointerX = 0;
    let smoothedPointerY = 0;

    window.addEventListener('mousemove', (event) => {
      cursorElement.classList.add('cursor--active');
      pointerX = event.clientX;
      pointerY = event.clientY;
      normalizedPointerX = pointerX / window.innerWidth - 0.5;
      normalizedPointerY = pointerY / window.innerHeight - 0.5;
    });

    document.addEventListener('mouseover', (event) => {
      const isOverInteractive = Boolean(event.target.closest('a, button, .stack-item, .project-card, .experience-item'));
      cursorElement.classList.toggle('cursor--large', isOverInteractive);
    });

    function applyParallax(element) {
      const parentBounds = element.parentElement.getBoundingClientRect();
      const isFarOffscreen = parentBounds.bottom < -200 || parentBounds.top > window.innerHeight + 200;
      if (isFarOffscreen) return;

      const speed = Number(element.dataset.parallaxSpeed);
      const scale = Number(element.dataset.parallaxScale) || 0;

      let offsetY = (parentBounds.top + parentBounds.height / 2 - window.innerHeight / 2) * speed;

      if (scale) {
        const maxOffset = parentBounds.height * (scale - 1) / 2;
        offsetY = Math.max(-maxOffset, Math.min(maxOffset, offsetY));
      }

      element.style.transform = 'translate3d(0,' + offsetY + 'px,0)' + (scale ? ' scale(' + scale + ')' : '');
    }

    function updateFrame() {
      smoothedPointerX += (normalizedPointerX - smoothedPointerX) * 0.07;
      smoothedPointerY += (normalizedPointerY - smoothedPointerY) * 0.07;
      cursorX += (pointerX - cursorX) * 0.16;
      cursorY += (pointerY - cursorY) * 0.16;

      if (hasFinePointer) {
        cursorElement.style.transform = 'translate(' + cursorX + 'px,' + cursorY + 'px)';
      }

      parallaxElements.forEach(applyParallax);

      if (heroVisualElement && hasFinePointer) {
        heroVisualElement.style.transform = 'translate3d(' + (smoothedPointerX * -22) + 'px,' + (smoothedPointerY * -22) + 'px,0)';
      }

      requestAnimationFrame(updateFrame);
    }

    requestAnimationFrame(updateFrame);

    // Magnetic hover for buttons and icon links
    selectAll('.button, .social-link, .icon-button').forEach((element) => {
      element.addEventListener('mousemove', (event) => {
        const bounds = element.getBoundingClientRect();
        const offsetX = (event.clientX - bounds.left - bounds.width / 2) * 0.28;
        const offsetY = (event.clientY - bounds.top - bounds.height / 2) * 0.35;
        element.style.transform = 'translate(' + offsetX + 'px,' + offsetY + 'px)';
      });
      element.addEventListener('mouseleave', () => {
        element.style.transform = '';
      });
    });
  }

  /* ------------------------------------------------------------------
     Header hide on scroll down, show on scroll up
     ------------------------------------------------------------------ */
  function initHeader() {
    const headerElement = selectOne('#siteHeader');
    const mobileMenuElement = selectOne('#mobileMenu');
    if (!headerElement || !mobileMenuElement) return;
    let lastScrollY = 0;

    window.addEventListener('scroll', () => {
      const currentScrollY = window.scrollY;
      const isScrollingDown = currentScrollY > lastScrollY;
      const isMenuOpen = mobileMenuElement.classList.contains('mobile-menu--open');

      headerElement.classList.toggle('site-header--scrolled', currentScrollY > 30);
      headerElement.classList.toggle('site-header--hidden', isScrollingDown && currentScrollY > 400 && !isMenuOpen);
      lastScrollY = currentScrollY;
    }, { passive: true });
  }

  /* ------------------------------------------------------------------
     Mobile menu
     ------------------------------------------------------------------ */
  function initMobileMenu() {
    const menuToggleButton = selectOne('#menuToggle');
    const mobileMenuElement = selectOne('#mobileMenu');
    if (!menuToggleButton || !mobileMenuElement) return;

    function setMenuOpen(isOpen) {
      mobileMenuElement.classList.toggle('mobile-menu--open', isOpen);
      menuToggleButton.setAttribute('aria-expanded', String(isOpen));
    }

    menuToggleButton.addEventListener('click', () => {
      setMenuOpen(!mobileMenuElement.classList.contains('mobile-menu--open'));
    });

    selectAll('a', mobileMenuElement).forEach((linkElement) => {
      linkElement.addEventListener('click', () => setMenuOpen(false));
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    });
  }

  /* ------------------------------------------------------------------
     Experience logos: fall back to initials if a logo file is missing
     ------------------------------------------------------------------ */
  function initExperienceLogoFallback() {
    selectAll('.experience-item__logo').forEach((logoElement) => {
      const logoImage = selectOne('img', logoElement);
      if (!logoImage) return;

      function showInitials() {
        logoElement.textContent = logoElement.dataset.initials || '';
      }

      logoImage.addEventListener('error', showInitials);
      if (logoImage.complete && logoImage.naturalWidth === 0) showInitials();
    });
  }

  function initHeroTitle() {
    const titleElement = selectOne('.hero__title');
    if (!titleElement) return null;

    const fullText = titleElement.textContent.trim();
    titleElement.setAttribute('aria-label', fullText);
    titleElement.textContent = '';

    fullText.split(/\s+/).forEach((word, index) => {
      const outer = document.createElement('span');
      outer.className = 'hero__word';
      outer.setAttribute('aria-hidden', 'true');

      const inner = document.createElement('span');
      inner.className = 'hero__word-inner';
      inner.style.setProperty('--i', index);
      inner.textContent = word;

      outer.appendChild(inner);
      titleElement.appendChild(outer);
      titleElement.appendChild(document.createTextNode(' '));
    });

    return titleElement;
  }

  function initProjectPreviews() {
    const API = 'https://api.microlink.io/?url=';

    async function fetchImage(url) {
      const cacheKey = 'og-image:' + url;
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) return cached;
      } catch (error) { /* ignore */ }

      const response = await fetch(API + encodeURIComponent(url));
      const result = await response.json();
      const imageUrl = result.status === 'success' && result.data.image && result.data.image.url;
      if (!imageUrl) return null;

      try { sessionStorage.setItem(cacheKey, imageUrl); } catch (error) { /* ignore */ }
      return imageUrl;
    }

    function loadCard(card) {
      const wrap = selectOne('.project-card__image', card);
      const img = wrap && selectOne('img', wrap);
      if (!img) return;

      const finish = () => wrap.classList.remove('project-card__image--loading');

      fetchImage(card.dataset.ogUrl)
        .then((imageUrl) => {
          if (!imageUrl) return finish();
          const probe = new Image();
          probe.onload = () => { img.style.display = ''; img.src = imageUrl; finish(); };
          probe.onerror = finish; // keep the fallback image
          probe.src = imageUrl;
        })
        .catch(finish);
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        loadCard(entry.target);
      });
    }, { rootMargin: '300px' });

    if (!('IntersectionObserver' in window)) return;

    selectAll('[data-og-url]').forEach((card) => {
      const wrap = selectOne('.project-card__image', card);
      if (wrap) wrap.classList.add('project-card__image--loading');
      observer.observe(card);
    });
  }

    /* ------------------------------------------------------------------
      Start
     ------------------------------------------------------------------ */
    initThemeToggle();
    initExperienceLogoFallback();
    initGuideLines();
    initPointerEffects();
    initHeader();
    initMobileMenu();
    initProjectPreviews();

    const heroTitleElement = initHeroTitle();

    initPreloader(() => {
      if (heroTitleElement) heroTitleElement.classList.add('hero__title--in');
      initScrollReveal();
      initCounters();
    });

})();
