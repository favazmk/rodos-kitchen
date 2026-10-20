/* RODOS — site motion & interactions */
const { gsap, ScrollTrigger, SplitText, Lenis } = window;
gsap.registerPlugin(ScrollTrigger, SplitText, ...(window.Flip ? [window.Flip] : []));
gsap.config({ nullTargetWarn: false });

const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

root.classList.add('js');
if (reduced) root.classList.add('reduced');

/* ---------- Smooth scroll ---------- */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.1, anchors: { offset: -10 } });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
const scrollTo = (target) => (lenis ? lenis.scrollTo(target, { offset: -10 }) : $(target)?.scrollIntoView());

/* ---------- Nav: hide on scroll down, solid after hero ---------- */
const nav = $('[data-nav]');
let lastY = 0;
ScrollTrigger.create({
  start: 0, end: 'max',
  onUpdate(self) {
    const y = self.scroll();
    nav.classList.toggle('is-solid', y > 40);
    nav.classList.toggle('is-hidden', y > lastY && y > innerHeight * 0.6 && !document.body.classList.contains('menu-open'));
    lastY = y;
  },
});

/* Mobile menu */
const burger = $('.nav__burger');
const menu = $('#menu');
const setMenu = (open) => {
  burger.setAttribute('aria-expanded', open);
  burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  document.body.classList.toggle('menu-open', open);
  if (open) {
    menu.hidden = false;
    lenis?.stop();
    gsap.fromTo(menu, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.7, ease: 'expo.out' });
    gsap.fromTo($$('nav a', menu), { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.05, duration: 0.7, ease: 'expo.out', delay: 0.1 });
  } else {
    lenis?.start();
    gsap.to(menu, { clipPath: 'inset(0 0 100% 0)', duration: 0.5, ease: 'expo.in', onComplete: () => (menu.hidden = true) });
  }
};
burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
$$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
addEventListener('keydown', (e) => e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true' && setMenu(false));

/* In-page anchors through Lenis */
$$('a[href^="#"]').forEach((a) =>
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2 || !$(id)) return;
    e.preventDefault();
    scrollTo(id);
  })
);

/* ---------- Intro curtain + hero entrance ---------- */
function heroIn() {
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.to('.hero__img-wrap', { clipPath: 'inset(0% 0 0 0)', duration: 1.6, ease: 'expo.inOut' }, 0)
    .fromTo('.hero__img-wrap img', { scale: 1.35 }, { scale: 1, duration: 2.2, ease: 'expo.out' }, 0.2)
    .to('.hero__line > span', { y: 0, yPercent: 0, duration: 1.4, stagger: 0.09 }, 0.35)
    .to('.hero__serif > span', { yPercent: 0, y: 0, duration: 1.3 }, 0.6)
    .to('[data-hero-fade]', { opacity: 1, y: 0, duration: 1.2, stagger: 0.08 }, 0.8);
  return tl;
}

/* The curtain: full intro (logo + counter) on the first page of a visit,
   a quick wipe on every page after that, and a cover on the way out. */
const loader = $('.loader');
const seen = (() => { try { return sessionStorage.getItem('rodos-seen') === '1'; } catch { return false; } })();
try { sessionStorage.setItem('rodos-seen', '1'); } catch {}

if (reduced) {
  loader?.remove();
} else if (loader) {
  const tl = gsap.timeline({ onComplete: () => (loader.style.pointerEvents = 'none') });
  if (seen) {
    loader.classList.add('is-quick');
    tl.to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 0.9, ease: 'expo.inOut', delay: 0.1 });
  } else {
    const count = $('.loader__count');
    const n = { v: 0 };
    tl.to('.loader__logo', { opacity: 1, duration: 0.6, ease: 'power2.out' })
      .to(n, { v: 100, duration: 1.1, ease: 'power2.inOut', onUpdate: () => (count.textContent = String(Math.round(n.v)).padStart(3, '0')) }, 0)
      .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 1, ease: 'expo.inOut' }, '+=0.1');
  }
  tl.add(heroIn(), '-=0.7');

  // Page-to-page: cover with the curtain, then navigate
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank' || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return;
    e.preventDefault();
    loader.classList.add('is-quick');
    loader.style.pointerEvents = 'auto';
    gsap.fromTo(loader, { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: 0.7, ease: 'expo.inOut', onComplete: () => (location.href = url.href) });
  });
  // Back/forward cache restores the covered page: uncover it
  addEventListener('pageshow', (e) => {
    if (e.persisted) gsap.to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 0.7, ease: 'expo.inOut', onComplete: () => (loader.style.pointerEvents = 'none') });
  });
}

/* ---------- Hero "close" — curtain as the page scrolls over it ---------- */
if (!reduced && $('[data-hero]')) {
  gsap.to('[data-hero]', {
    scale: 0.92, opacity: 0.35, borderRadius: 24, ease: 'none',
    scrollTrigger: { trigger: '[data-hero]', start: 'top top', end: 'bottom top', scrub: true, pin: true, pinSpacing: false },
  });
  gsap.to('.hero__img-wrap img', { yPercent: 12, ease: 'none', scrollTrigger: { trigger: '[data-hero]', start: 'top top', end: 'bottom top', scrub: true } });
}
/* Inner pages: hero image closes in (scales down, rounds) as it scrolls away */
if (!reduced && $('.phero')) {
  gsap.to('.phero .hero__img-wrap', { scale: 0.9, borderRadius: 28, ease: 'none', scrollTrigger: { trigger: '.phero__media', start: 'top 30%', end: 'bottom top', scrub: true } });
  gsap.fromTo('.phero .hero__img-wrap img', { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: '.phero__media', start: 'top bottom', end: 'bottom top', scrub: true } });
}

/* ---------- Generic scroll reveals ---------- */
function setupReveals() {
  if (reduced) return;

  $$('[data-split]').forEach((el) => {
    SplitText.create(el, {
      type: 'lines', mask: 'lines', linesClass: 'split-line', autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 105, duration: 1.2, stagger: 0.08, ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 85%' },
        }),
    });
  });

  $$('[data-reveal]').forEach((el) =>
    gsap.to(el, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%' } })
  );

  $$('[data-clip]').forEach((el) => {
    const img = $('img', el);
    gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 85%' } })
      .to(el, { clipPath: 'inset(0% 0 0 0)', duration: 1.4, ease: 'expo.inOut' })
      .from(img, { scale: 1.3, duration: 1.8, ease: 'expo.out' }, 0.1);
  });

  /* Parallax: data-speed < 1 lags, > 1 leads */
  $$('[data-speed]').forEach((el) => {
    const s = parseFloat(el.dataset.speed);
    gsap.fromTo(el, { yPercent: (1 - s) * -60 }, {
      yPercent: (1 - s) * 60, ease: 'none',
      scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  /* Statement: words light up as you read */
  const st = $('[data-words]');
  if (st) {
    const split = SplitText.create(st, { type: 'words', wordsClass: 'w' });
    gsap.to(split.words, {
      opacity: 1, stagger: 0.1, ease: 'none',
      scrollTrigger: { trigger: st, start: 'top 78%', end: 'bottom 45%', scrub: true },
    });
  }

  /* Counters */
  $$('[data-count]').forEach((el) => {
    const n = { v: 0 };
    gsap.to(n, {
      v: +el.dataset.count, duration: 1.8, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 92%' },
      onUpdate: () => (el.textContent = Math.round(n.v) + (el.dataset.suffix || '')),
    });
  });

  /* Dark sections close over the previous one with rounded shoulders */
  $$('.why, .factory').forEach((el) =>
    gsap.from(el, { borderRadius: '60px 60px 0 0', ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'top 40%', scrub: true } })
  );

  /* Footer wordmark letters rise */
  const fw = $('[data-footer-word]');
  if (fw) {
    const split = SplitText.create(fw, { type: 'chars', charsClass: 'ch' });
    gsap.from(split.chars, {
      yPercent: 70, opacity: 0, stagger: 0.06, duration: 1.4, ease: 'expo.out',
      scrollTrigger: { trigger: fw, start: 'top 95%' },
    });
  }
}

/* ---------- Range: horizontal scroll on pinned track ---------- */
function setupRange() {
  const track = $('[data-range-track]');
  const section = $('[data-range]');
  if (!track || reduced) return;
  const mm = gsap.matchMedia();
  mm.add('(min-width: 700px)', () => {
    const dist = () => track.scrollWidth - innerWidth;
    gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: track, start: 'center center', end: () => '+=' + dist(), pin: section, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1 },
    });
    // cards tilt slightly with scroll velocity
    const tilt = gsap.quickTo($$('.card', track), 'skewX', { duration: 0.5, ease: 'power3' });
    ScrollTrigger.create({ trigger: section, start: 'top bottom', end: 'bottom top', onUpdate: (s) => tilt(gsap.utils.clamp(-6, 6, s.getVelocity() / -400)) });
  });
  mm.add('(max-width: 699px)', () => {
    // swipeable on phones
    track.style.overflowX = 'auto';
    track.style.width = '100%';
    track.style.scrollSnapType = 'x mandatory';
    $$('.card', track).forEach((c) => (c.style.scrollSnapAlign = 'start'));
  });
}

/* ---------- Marquee with scroll-velocity boost ---------- */
function setupMarquee() {
  const row = $('[data-marquee]');
  if (!row) return;
  row.innerHTML += row.innerHTML; // seamless loop
  $$('img', row).forEach((img, i) => i >= $$('img', row).length / 2 && img.setAttribute('aria-hidden', 'true'));
  if (reduced) return;
  const loop = gsap.to(row, { xPercent: -50, duration: 28, ease: 'none', repeat: -1 });
  let dir = 1;
  ScrollTrigger.create({
    trigger: row, start: 'top bottom', end: 'bottom top',
    onUpdate: (s) => {
      dir = s.direction;
      gsap.to(loop, { timeScale: dir * (1 + Math.min(Math.abs(s.getVelocity()) / 300, 5)), duration: 0.2, overwrite: true });
      gsap.to(loop, { timeScale: dir, duration: 1.2, delay: 0.2, ease: 'power2.out' });
    },
  });
  gsap.fromTo($$('img', row), { rotate: -8 }, { rotate: 8, ease: 'none', scrollTrigger: { trigger: row, start: 'top bottom', end: 'bottom top', scrub: true } });
}

/* ---------- Process line ---------- */
function setupProcess() {
  const list = $('[data-process]');
  if (!list) return;
  const items = $$('li', list);
  if (reduced) return items.forEach((li) => li.classList.add('is-on'));
  ScrollTrigger.create({
    trigger: list, start: 'top 65%', end: 'bottom 65%', scrub: true,
    onUpdate: (s) => list.style.setProperty('--p', s.progress.toFixed(3)),
  });
  items.forEach((li) => ScrollTrigger.create({ trigger: li, start: 'top 65%', onToggle: (s) => li.classList.toggle('is-on', s.isActive || s.progress === 1), end: 'max' }));
  gsap.from(items, { opacity: 0, x: 40, stagger: 0.1, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: list, start: 'top 80%' } });
}

/* ---------- Hover previews that follow the cursor ---------- */
function followPreview(listSel, itemSel, previewSel, mode) {
  const list = $(listSel);
  const box = $(previewSel);
  if (!list || !box || !finePointer) return;
  const img = $('img', box);
  const xTo = gsap.quickTo(box, 'x', { duration: 0.6, ease: 'power3' });
  const yTo = gsap.quickTo(box, 'y', { duration: 0.6, ease: 'power3' });
  const rTo = gsap.quickTo(box, 'rotation', { duration: 0.8, ease: 'power3' });
  let px = 0;
  addEventListener('pointermove', (e) => {
    xTo(e.clientX); yTo(e.clientY);
    rTo(gsap.utils.clamp(-10, 10, (e.clientX - px) * 0.6)); px = e.clientX;
  });
  $$(itemSel, list).forEach((item) => {
    item.addEventListener('pointerenter', () => {
      if (img.getAttribute('src') !== item.dataset.img) img.src = item.dataset.img;
      if (mode === 'clip') gsap.to(box, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.6, ease: 'expo.out', overwrite: 'auto' });
      else gsap.to(box, { opacity: 1, scale: 1, duration: 0.5, ease: 'expo.out', overwrite: 'auto' });
      gsap.fromTo(img, { scale: 1.25 }, { scale: 1, duration: 0.9, ease: 'expo.out' });
    });
  });
  const hide = () => {
    if (mode === 'clip') gsap.to(box, { clipPath: 'inset(50% 50% 50% 50%)', duration: 0.5, ease: 'expo.inOut', overwrite: 'auto' });
    else gsap.to(box, { opacity: 0, scale: 0.6, duration: 0.4, ease: 'power3.in', overwrite: 'auto' });
  };
  list.addEventListener('pointerleave', hide);
  // scrolling away without moving the mouse never fires pointerleave
  addEventListener('scroll', () => !list.matches(':hover') && hide(), { passive: true });
}

/* ---------- Magnetic buttons ---------- */
function setupMagnetic() {
  if (!finePointer || reduced) return;
  $$('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.3);
      yTo((e.clientY - r.top - r.height / 2) * 0.4);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}

/* ---------- Cursor ---------- */
function setupCursor() {
  if (!finePointer || reduced) return;
  root.classList.add('has-cursor');
  const c = $('.cursor');
  const label = $('.cursor__label', c);
  const xTo = gsap.quickTo(c, 'x', { duration: 0.35, ease: 'power3' });
  const yTo = gsap.quickTo(c, 'y', { duration: 0.35, ease: 'power3' });
  gsap.set(c, { scale: 0 });
  addEventListener('pointermove', (e) => { xTo(e.clientX); yTo(e.clientY); }, { passive: true });
  addEventListener('pointermove', (e) => { gsap.set(c, { x: e.clientX, y: e.clientY }); gsap.to(c, { scale: 1, duration: 0.3 }); }, { once: true });
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest('[data-cursor]');
    c.classList.toggle('is-label', !!t);
    if (t) label.textContent = t.dataset.cursor;
    const hot = e.target.closest('a, button, input, select, textarea, label');
    gsap.to(c, { scale: hot && !t ? 0 : 1, duration: 0.3 });
  });
  document.addEventListener('pointerleave', () => gsap.to(c, { scale: 0, duration: 0.3 }));
  document.addEventListener('pointerenter', () => gsap.to(c, { scale: 1, duration: 0.3 }));
}

/* ---------- Lightbox ---------- */
function setupLightbox() {
  const dlg = $('[data-lightbox]');
  if (!dlg) return;
  const img = $('img', dlg);
  $$('[data-full]').forEach((btn) =>
    btn.addEventListener('click', () => {
      img.src = btn.dataset.full;
      img.alt = $('img', btn).alt;
      dlg.showModal();
      lenis?.stop();
      if (!reduced) gsap.fromTo(img, { clipPath: 'inset(10% 10% 10% 10% round 12px)', scale: 0.96 }, { clipPath: 'inset(0% 0% 0% 0% round 6px)', scale: 1, duration: 0.8, ease: 'expo.out' });
    })
  );
  $('.lightbox__close', dlg).addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => e.target === dlg && dlg.close());
  dlg.addEventListener('close', () => lenis?.start());
}

/* ---------- Enquiry form → WhatsApp ---------- */
function setupForm() {
  const form = $('[data-form]');
  if (!form) return;
  const status = $('.form__status', form);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fields = [form.name, form.phone];
    let ok = true;
    fields.forEach((f) => {
      const valid = f.value.trim() !== '' && f.checkValidity();
      f.setAttribute('aria-invalid', String(!valid));
      if (!valid) ok = false;
    });
    if (!ok) {
      status.textContent = 'Please add your name and a valid phone number.';
      fields.find((f) => f.getAttribute('aria-invalid') === 'true')?.focus();
      if (!reduced) gsap.fromTo(form, { x: -8 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
      return;
    }
    const d = new FormData(form);
    const msg = [
      'Hello Rodos, I would like to plan a kitchen.',
      `Name: ${d.get('name').trim()}`,
      `Phone: ${d.get('phone').trim()}`,
      `Home: ${d.get('home')}`,
      `Location: ${d.get('area')}`,
      d.get('message').trim() && `Notes: ${d.get('message').trim()}`,
    ].filter(Boolean).join('\n');
    window.open('https://wa.me/971559497048?text=' + encodeURIComponent(msg), '_blank', 'noopener');
    status.textContent = 'Opening WhatsApp — thank you! Send the message there and our team will reply.';
  });
  $$('input, select, textarea', form).forEach((f) => f.addEventListener('input', () => f.removeAttribute('aria-invalid')));
}

/* ---------- Projects: filter with a FLIP layout animation ---------- */
function setupFilters() {
  const bar = $('[data-filters]');
  const grid = $('[data-pgrid]');
  if (!bar || !grid) return;
  const cells = $$('.pcell', grid);
  const layout = () => {
    let i = 0;
    cells.forEach((c) => { if (c.style.display !== 'none') c.classList.toggle('is-wide', i++ % 7 === 0); });
  };
  layout();
  if (!reduced) ScrollTrigger.batch(cells, { start: 'top 92%', once: true, onEnter: (els) => gsap.from(els, { opacity: 0, y: 40, scale: 0.96, stagger: 0.06, duration: 1, ease: 'expo.out' }) });

  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]');
    if (!b || b.classList.contains('is-on')) return;
    $$('[data-filter]', bar).forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    const f = b.dataset.filter;
    const gallery = grid.closest('[data-pgallery]');
    gallery?.dispatchEvent(new CustomEvent('rodos:filter', { detail: f })); // the 3D ring re-spaces itself
    const gridShown = !gallery || gallery.classList.contains('is-grid');
    const state = window.Flip && !reduced && gridShown ? Flip.getState(cells) : null;
    cells.forEach((c) => (c.style.display = f === 'all' || c.dataset.cat === f ? '' : 'none'));
    layout();
    if (!state) return ScrollTrigger.refresh();
    Flip.from(state, {
      duration: 0.8, ease: 'expo.inOut', absolute: true, scale: true, nested: true,
      onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.6, delay: 0.2 }),
      onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.85, duration: 0.4 }),
      onComplete: () => ScrollTrigger.refresh(),
    });
  });
}

/* ---------- Boot ---------- */
setupReveals();
setupRange();
setupMarquee();
setupProcess();
followPreview('[data-why-list]', '.why__item', '.why__float', 'fade');
followPreview('[data-collections]', 'li', '.collections__preview', 'clip');
setupMagnetic();
setupCursor();
setupLightbox();
setupForm();
setupFilters();

/* 3D anatomy — loaded only when WebGL is available */
const anatomy = $('[data-anatomy]');
const gl = document.createElement('canvas').getContext('webgl2');
if (anatomy && gl) {
  import('./kitchen3d.js?v=8')
    .then((m) => {
      m.initKitchen(anatomy, { reduced, gsap, ScrollTrigger });
      // the 3D pin is created after later sections' triggers: re-order and recalc
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
    })
    .catch((err) => { console.error(err); root.classList.add('no-webgl'); });
} else {
  root.classList.add('no-webgl');
}

/* Projects — 3D ring gallery, with the grid as the alternative view */
const gallery = $('[data-pgallery]');
if (gallery) {
  const setView = (v) => {
    gallery.classList.toggle('is-grid', v === 'grid');
    $$('[data-view]', gallery).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
    ScrollTrigger.refresh();
  };
  $$('[data-view]', gallery).forEach((b) =>
    b.addEventListener('click', () => {
      if (b.getAttribute('aria-pressed') === 'true') return;
      setView(b.dataset.view);
      if (!reduced) gsap.from(b.dataset.view === 'grid' ? '.pgrid' : '.ring', { opacity: 0, y: 40, duration: 0.9, ease: 'expo.out' });
    })
  );
  if (gl && !reduced) {
    import('./ring.js?v=11')
      .then((m) => m.initRing(gallery, { gsap, ScrollTrigger }))
      .catch((err) => { console.error(err); root.classList.add('no-ring'); setView('grid'); });
  } else {
    root.classList.add('no-ring');
    setView('grid');
  }
}

addEventListener('load', () => {
  ScrollTrigger.refresh();
  // arriving with a #hash from another page: jump once pins are measured
  if (location.hash && $(location.hash)) requestAnimationFrame(() => (lenis ? lenis.scrollTo(location.hash, { immediate: true, offset: -10 }) : $(location.hash).scrollIntoView()));
});
