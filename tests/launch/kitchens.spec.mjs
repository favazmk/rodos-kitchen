// Kitchens: range cards scroll sideways on a pinned track (desktop), swipe row on phones
import { open, pinRange, hold } from './lib/site.mjs';

function rangeInvariant() {
  const bad = [];
  const sec = document.querySelector('[data-range]');
  const track = sec.querySelector('[data-range-track]');
  const cards = [...track.querySelectorAll('.card')];
  if (document.documentElement.scrollWidth > innerWidth + 1) bad.push({ page: 'horizontal overflow', sw: document.documentElement.scrollWidth });
  const st = window.ScrollTrigger.getAll().find((t) => t.pin === sec);
  if (innerWidth >= 700) {
    if (!st) return { bad: ['range pin missing on desktop'] };
    const dist = track.scrollWidth - innerWidth;
    const x = +window.gsap.getProperty(track, 'x');
    if (Math.abs(x + dist * st.progress) > 4) bad.push({ range: 'track out of step with scroll', x: Math.round(x), want: Math.round(-dist * st.progress), p: +st.progress.toFixed(3) });
    const r = sec.getBoundingClientRect();
    if (st.isActive && Math.abs(r.top) > 2 && r.top > 0) bad.push({ range: 'pinned section drifted', top: Math.round(r.top) });
    if (st.progress >= 0.999) {
      const last = cards.at(-1).getBoundingClientRect();
      if (last.right > innerWidth + 2) bad.push({ range: 'last card cut off at the end', right: Math.round(last.right) });
    }
  } else {
    if (st) bad.push('pin still active on phone width');
    if (getComputedStyle(track).overflowX !== 'auto') bad.push({ range: 'phone track not swipeable' });
  }
  return bad.length ? { y: Math.round(scrollY), bad } : true;
}

export default async function (api) {
  const { settle, scrollToY, randomWalk, check, shot } = api;
  for (const device of ['desktop', 'phone']) {
    const { ctx, page, log } = await open(api, device, 'kitchens.html');
    await hold(api, page, `${device} fresh load`, rangeInvariant);
    const rg = await pinRange(page, '[data-range]');
    if (device === 'desktop') {
      if (!rg) { check('desktop range pin exists', false); }
      else {
        const ry = (p) => Math.round(rg.start + (rg.end - rg.start) * p);
        for (const p of [0, 0.25, 0.5, 0.75, 1]) {
          await scrollToY(page, device, ry(p)); await settle(page, 2200);
          await hold(api, page, `desktop range at ${p}`, rangeInvariant);
        }
        await scrollToY(page, device, ry(0.5)); await settle(page, 1500);
        await page.reload({ waitUntil: 'networkidle' }); await settle(page, 3500);
        await hold(api, page, 'desktop reload mid-range', rangeInvariant);
        await scrollToY(page, device, 0); await settle(page, 2500);
        await hold(api, page, 'desktop reload mid-range then top', rangeInvariant);
        await scrollToY(page, device, ry(1) + 1500); await settle(page, 1200);
        await scrollToY(page, device, ry(0.6)); await settle(page, 2500);
        await hold(api, page, 'desktop range entered from below', rangeInvariant);
        await page.setViewportSize({ width: 1100, height: 760 }); await settle(page, 2500);
        await hold(api, page, 'desktop resize inside range', rangeInvariant);
        await page.setViewportSize(api.devices.desktop.viewport); await settle(page, 2500);

        // collections: hover a row, the preview opens with its photo; leave, it closes
        const li = page.locator('[data-collections] li').first();
        await li.scrollIntoViewIfNeeded(); await settle(page, 1500);
        await li.hover(); await settle(page, 1000);
        const shown = await page.evaluate(() => {
          const box = document.querySelector('.collections__preview');
          return { clip: getComputedStyle(box).clipPath, src: box.querySelector('img').getAttribute('src'), want: document.querySelector('[data-collections] li').dataset.img };
        });
        check('desktop collections preview opens on hover', !/50%/.test(shown.clip) && shown.src === shown.want, shown);
        await page.mouse.move(5, 5); await settle(page, 900);
        const clip = await page.evaluate(() => getComputedStyle(document.querySelector('.collections__preview')).clipPath);
        check('desktop collections preview closes on leave', /50%/.test(clip), clip);
      }
    } else {
      await page.evaluate(() => document.querySelector('[data-range]').scrollIntoView()); await settle(page, 1500);
      const sw = await page.evaluate(async () => {
        const t = document.querySelector('[data-range-track]');
        t.scrollTo({ left: t.scrollWidth }); await new Promise((r) => setTimeout(r, 800));
        return { end: Math.round(t.scrollLeft + t.clientWidth), sw: t.scrollWidth };
      });
      check('phone range row swipes to the last card', sw.end >= sw.sw - 2, sw);
      await hold(api, page, 'phone range in view', rangeInvariant);
    }
    for (const seed of [3, 17]) {
      await page.goto(api.baseURL + 'kitchens.html', { waitUntil: 'networkidle' }); await settle(page, 3000);
      const bad = await randomWalk(page, device, {
        invariant: (p) => p.evaluate(rangeInvariant), seed, moves: 14,
        onBad: (p, m) => shot(p, `kitchens-walk-${device}-${seed}-${m}`),
      });
      check(`${device} random walk seed ${seed}`, bad.length === 0, bad.slice(0, 3));
    }
    check(`${device} no runtime errors`, log.errors.length === 0, log.errors);
    await ctx.close();
  }
}
