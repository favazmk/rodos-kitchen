// Home: pinned film hero (captions per chapter), pinned 3D anatomy (one step at a time), work ring captions
import { open, pinRange, hold, lightbox } from './lib/site.mjs';

// Everything on screen must agree with the scroll position
function homeInvariant() {
  const ST = window.ScrollTrigger, bad = [];
  const vis = (el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility === 'visible' && +cs.opacity > 0.5; };
  const onScreen = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };
  const y = Math.round(scrollY);

  const loader = document.querySelector('.loader');
  if (loader && getComputedStyle(loader).pointerEvents !== 'none') bad.push('curtain still covers the page');

  // film: one caption at a time, the right one for the scroll position, headline fully in at the top
  const film = document.querySelector('[data-film]');
  const fst = ST.getAll().find((t) => t.trigger === film && t.pin);
  if (!fst) bad.push('film ScrollTrigger missing');
  else if (onScreen(film)) {
    const p = fst.progress;
    const chapters = [...film.querySelectorAll('[data-film-chapter]')];
    const shown = chapters.map((c, i) => (vis(c) ? i : -1)).filter((i) => i >= 0);
    const intro = film.querySelector('[data-film-intro]');
    const introOn = vis(intro);
    if (shown.length + introOn > 1) bad.push({ film: 'two captions on screen', p, shown, introOn });
    const solid = chapters.findIndex((c) => { const [a, b] = c.dataset.filmChapter.split(',').map(Number); return p >= a + 0.08 && (b >= 1 || p <= b - 0.08); });
    if (solid >= 0 && !(shown.length === 1 && shown[0] === solid)) bad.push({ film: 'wrong chapter caption', p, expected: solid, shown });
    if (p < 0.08) {
      if (!introOn) bad.push({ film: 'headline hidden at the start', p });
      [...intro.querySelectorAll('.hero__line > span')].forEach((s, i) => {
        const d = s.getBoundingClientRect().top - s.parentElement.getBoundingClientRect().top;
        if (Math.abs(d) > 3) bad.push({ film: `headline line ${i} not risen`, offset: Math.round(d) });
      });
      [...film.querySelectorAll('[data-hero-fade]')].forEach((el, i) => !vis(el) && bad.push({ film: `hero fade item ${i} hidden`, p }));
    }
    if (p > 0.3 && introOn) bad.push({ film: 'headline still showing past the door', p });
    if (!film.classList.contains('is-live')) bad.push('film canvas never painted a frame');
  }

  // anatomy: exactly one step visible, matching counter, progress bar and scroll position
  const sec = document.querySelector('[data-anatomy]');
  const noGl = document.documentElement.classList.contains('no-webgl');
  if (sec && noGl && document.createElement('canvas').getContext('webgl2')) bad.push('3D section fell back to no-webgl although WebGL2 works (init crashed?)');
  if (sec && !noGl) {
    const ast = ST.getAll().find((t) => t.trigger === sec && t.pin);
    if (!ast) bad.push('anatomy ScrollTrigger missing');
    else if (onScreen(sec)) {
      const p = ast.progress, f = p * 5;
      const lis = [...sec.querySelectorAll('.anatomy__steps li')];
      const active = lis.map((l, i) => (l.classList.contains('is-active') ? i : -1)).filter((i) => i >= 0);
      const shown = lis.map((l, i) => (vis(l) ? i : -1)).filter((i) => i >= 0);
      const num = +sec.querySelector('[data-step-num]').textContent - 1;
      const exp = Math.min(4, Math.floor(f));
      const nearEdge = Math.abs(f - Math.round(f)) < 0.03 && f > 0.03 && f < 4.97;
      const sx = +(/scaleX\(([\d.e-]+)\)/.exec(sec.querySelector('[data-anatomy-bar]').style.transform) || [0, -1])[1];
      if (active.length !== 1 || shown.length !== 1 || active[0] !== shown[0] || num !== active[0] || (!nearEdge && active[0] !== exp))
        bad.push({ anatomy: 'step state disagrees', p: +p.toFixed(3), expected: exp, active, shown, counter: num });
      if (Math.abs(sx - p) > 0.02) bad.push({ anatomy: 'progress bar off', bar: sx, p });
      const checked = [...sec.querySelectorAll('[data-finish]')].filter((b) => b.getAttribute('aria-checked') === 'true').length;
      if (checked !== 1) bad.push({ anatomy: 'finish radios checked', checked });
      const pin = sec.querySelector('.anatomy__pin-label');
      if (!pin.textContent.trim()) bad.push({ anatomy: 'annotation label empty' });
    }
  }

  // work ring: caption, number and counter describe the same photo
  const wr = document.querySelector('[data-work-ring]');
  const stage = wr?.querySelector('[data-ring]');
  if (wr?.classList.contains('has-ring') && onScreen(stage)) {
    const cells = [...wr.querySelectorAll('.pcell')];
    const num = +wr.querySelector('[data-ring-num]').textContent;
    const title = wr.querySelector('[data-ring-title]').textContent.trim();
    const count = wr.querySelector('[data-ring-count]').textContent.trim();
    const cap = cells[num - 1]?.querySelector('.shot__cap')?.textContent.trim();
    if (!title || title !== cap || !count.endsWith('/ ' + String(cells.length).padStart(2, '0')))
      bad.push({ ring: 'caption disagrees', num, title, cap, count });
  }
  return bad.length ? { y, bad } : true;
}

export default async function (api) {
  const { settle, scrollToY, randomWalk, check, shot, wait } = api;

  for (const device of ['desktop', 'phone']) {
    const { ctx, page, log } = await open(api, device, '');
    await hold(api, page, `${device} fresh load`, homeInvariant);

    // film: every chapter in turn
    const film = await pinRange(page, '[data-film]');
    const fy = (p) => Math.round(film.start + (film.end - film.start) * p);
    for (const p of [0.04, 0.32, 0.55, 0.76, 0.95]) {
      await scrollToY(page, device, fy(p)); await settle(page, 2200);
      await hold(api, page, `${device} film at ${p}`, homeInvariant);
    }
    await scrollToY(page, device, 0); await settle(page, 2200);
    await hold(api, page, `${device} film back to top`, homeInvariant);

    // reload part-way through the film, then scroll back up
    await scrollToY(page, device, fy(0.55)); await settle(page, 1500);
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 3500);
    await hold(api, page, `${device} reload mid-film`, homeInvariant);
    await scrollToY(page, device, 0); await settle(page, 2500);
    await hold(api, page, `${device} reload mid-film then top`, homeInvariant);

    // anatomy: each step, the radio group, reload inside, enter from below
    const an = await pinRange(page, '[data-anatomy]');
    if (!an) { api.warn(`${device} anatomy`, 'no 3D pin (no WebGL in this browser) — section not tested'); }
    else {
      const ay = (i) => Math.round(an.start + ((an.end - an.start) * (i + 0.5)) / 5);
      for (let i = 0; i < 5; i++) {
        await scrollToY(page, device, ay(i)); await settle(page, 2200);
        await hold(api, page, `${device} anatomy step ${i + 1}`, homeInvariant);
      }
      await scrollToY(page, device, ay(1)); await settle(page, 2000);
      for (const f of ['oak', 'graphite', 'sand', 'steel']) {
        await page.click(`[data-finish="${f}"]`); await settle(page, 600);
        const st = await page.evaluate((f) => [...document.querySelectorAll('[data-finish]')].map((b) => `${b.dataset.finish}:${b.getAttribute('aria-checked')}`).join(' '), f);
        check(`${device} finish ${f} selects only itself`, st.includes(`${f}:true`) && (st.match(/:true/g) || []).length === 1, st);
      }
      if (device === 'desktop') {
        await page.focus('[data-finish="steel"]'); await page.keyboard.press('ArrowRight'); await settle(page, 500);
        const k = await page.evaluate(() => ({ checked: document.querySelector('[aria-checked="true"][data-finish]')?.dataset.finish, focus: document.activeElement?.dataset.finish }));
        check('desktop finish radios: ArrowRight moves selection and focus', k.checked === 'oak' && k.focus === 'oak', k);
      }
      await scrollToY(page, device, ay(2)); await settle(page, 1500);
      await page.reload({ waitUntil: 'networkidle' }); await settle(page, 4000);
      await hold(api, page, `${device} reload mid-anatomy`, homeInvariant);
      await scrollToY(page, device, 0); await settle(page, 2500);
      await hold(api, page, `${device} reload mid-anatomy then top`, homeInvariant);
      const an2 = await pinRange(page, '[data-anatomy]');
      await scrollToY(page, device, an2.end + 900); await settle(page, 1500);
      await scrollToY(page, device, Math.round(an2.start + ((an2.end - an2.start) * 3.5) / 5)); await settle(page, 2500);
      await hold(api, page, `${device} anatomy entered from below`, homeInvariant);
      if (device === 'desktop') {
        await page.setViewportSize({ width: 1100, height: 760 }); await settle(page, 2500);
        await hold(api, page, 'desktop resize inside anatomy', homeInvariant);
        await page.setViewportSize(api.devices.desktop.viewport); await settle(page, 2500);
        await hold(api, page, 'desktop resize back inside anatomy', homeInvariant);
      }
    }

    // work ring: prev/next turn it, caption follows; clicking the front photo opens the lightbox
    const hasRing = await page.evaluate(() => document.querySelector('[data-work-ring]')?.classList.contains('has-ring'));
    if (!hasRing) api.warn(`${device} work ring`, 'ring did not start (no WebGL?) — grid fallback shown');
    else {
      await page.evaluate(() => document.querySelector('[data-work-ring] [data-ring]').scrollIntoView({ block: 'center' }));
      await settle(page, 2500);
      await hold(api, page, `${device} work ring in view`, homeInvariant);
      for (const btn of ['[data-ring-next]', '[data-ring-next]', '[data-ring-prev]']) {
        const before = await page.textContent('[data-work-ring] [data-ring-num]');
        await page.click(`[data-work-ring] ${btn}`); await settle(page, 1800);
        const after = await page.textContent('[data-work-ring] [data-ring-num]');
        check(`${device} work ring ${btn} turns to another photo`, before !== after, { before, after });
        await hold(api, page, `${device} work ring after ${btn}`, homeInvariant);
      }
      const srcs = await page.$$eval('[data-work-ring] .pcell', (c) => c.map((x) => x.dataset.full));
      const box = await page.locator('[data-work-ring] [data-ring] canvas').boundingBox();
      await lightbox(api, page, device, 'work ring photo click',
        () => page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.62), (s) => srcs.includes(s));
    }

    // statement photo pill opens the lightbox with its own photo
    const pill = page.locator('[data-pill]').first();
    await pill.scrollIntoViewIfNeeded(); await settle(page, 1500);
    const pillSrc = await pill.getAttribute('data-full');
    await lightbox(api, page, device, 'statement pill', () => pill.click(), pillSrc);

    // seeded random visitors
    for (const seed of [11, 29]) {
      await page.goto(api.baseURL, { waitUntil: 'networkidle' }); await settle(page, 3000);
      const bad = await randomWalk(page, device, {
        invariant: (p) => p.evaluate(homeInvariant), seed, moves: 16,
        clicks: ['[data-work-ring] [data-ring-next]', '[data-work-ring] [data-ring-prev]', '[data-finish="oak"]', '[data-finish="steel"]'],
        onBad: (p, m) => shot(p, `home-walk-${device}-${seed}-${m}`),
      });
      check(`${device} random walk seed ${seed}`, bad.length === 0, bad.slice(0, 3));
    }
    check(`${device} no runtime errors`, log.errors.length === 0, log.errors);
    await ctx.close();
  }

  // phone rotated to landscape: fresh context (an isMobile context keeps its screen width)
  const land = { viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 } };
  const { ctx, page } = await open(api, 'phone', '', land);
  const film = await pinRange(page, '[data-film]');
  await scrollToY(page, 'phone', Math.round(film.start + (film.end - film.start) * 0.55)); await settle(page, 2200);
  await hold(api, page, 'phone landscape mid-film', homeInvariant);
  const an = await pinRange(page, '[data-anatomy]');
  if (an) {
    await scrollToY(page, 'phone', Math.round(an.start + (an.end - an.start) * 0.5)); await settle(page, 2200);
    await hold(api, page, 'phone landscape mid-anatomy', homeInvariant);
  }
  await ctx.close();
  await wait(0);
}
